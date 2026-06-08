// Expo config-plugin: laat de `fmt`-library (meegeleverd door React Native 0.76)
// compileren met de nieuwste Xcode/Clang. De fout was:
//   "call to consteval function 'fmt::basic_format_string<...>' is not a
//    constant expression"
// Door FMT_USE_CONSTEVAL=0 te zetten valt fmt's format-string-check terug op
// runtime (constexpr) i.p.v. de harde consteval-compile-fout. (FMT_CONSTEVAL
// zelf wordt door fmt onvoorwaardelijk gedefinieerd; FMT_USE_CONSTEVAL is met
// #ifndef afgeschermd en dus wél overschrijfbaar.)
//
// We injecteren dit in het post_install-blok van de Podfile (alle pod-targets),
// zodat elk target dat fmt gebruikt (RCT-Folly, React-core, …) het oppikt.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# fmt-consteval-fix';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |fmt_fix_target|
      fmt_fix_target.build_configurations.each do |fmt_fix_config|
        defs = fmt_fix_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        fmt_fix_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['FMT_USE_CONSTEVAL=0']
        flags = fmt_fix_config.build_settings['OTHER_CPLUSPLUSFLAGS'] || ['$(inherited)']
        flags = [flags] unless flags.is_a?(Array)
        fmt_fix_config.build_settings['OTHER_CPLUSPLUSFLAGS'] = flags + ['-DFMT_USE_CONSTEVAL=0']
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        // Achteraan het post_install-blok injecteren (vóór de afsluitende `end`),
        // zodat het ná Expo's react_native_post_install draait en niet wordt
        // overschreven.
        contents = contents.replace(
          /(post_install do \|installer\|[\s\S]*?)\n(  end)/,
          (full, body, endLine) => `${body}\n${SNIPPET}\n${endLine}`
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
