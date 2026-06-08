// Expo config-plugin: laat de `fmt`-library (meegeleverd door React Native 0.76)
// compileren met de nieuwste Xcode/Clang. De fout was:
//   "call to consteval function 'fmt::basic_format_string<...>' is not a
//    constant expression"
// Door FMT_CONSTEVAL te definiëren als `constexpr` i.p.v. `consteval` valt de
// format-string-check terug op runtime i.p.v. een harde compile-fout.
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
        fmt_fix_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['FMT_CONSTEVAL=constexpr']
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
        contents = contents.replace(/post_install do \|installer\|/, (m) => `${m}\n${SNIPPET}`);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
