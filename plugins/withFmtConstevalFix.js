// Expo config-plugin: laat de `fmt`-library (meegeleverd door React Native 0.76)
// compileren met de nieuwste Xcode/Clang (Xcode 26 / iOS 26 SDK). De fout was:
//   "call to consteval function 'fmt::basic_format_string<...>' is not a
//    constant expression"  (in Pods/fmt/include/fmt/format-inl.h)
//
// Met FMT_USE_CONSTEVAL=0 gebruikt fmt geen `consteval` meer → de format-string-
// check valt terug op runtime en compileert. We zetten die define op twee
// plekken zodat het zeker doorkomt:
//   1) DIRECT in RN's fmt.podspec (het fmt-target dat format.cc compileert);
//   2) in het Podfile post_install op alle pod-targets (consumenten van fmt).

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# fmt-consteval-fix';
const PODFILE_SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |fmt_fix_target|
      fmt_fix_target.build_configurations.each do |fmt_fix_config|
        defs = fmt_fix_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        fmt_fix_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs + ['FMT_USE_CONSTEVAL=0']
      end
    end
`;

// Voeg FMT_USE_CONSTEVAL=0 toe aan het fmt-target via zijn podspec.
function patchFmtPodspec(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules/react-native/third-party-podspecs/fmt.podspec'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    let c = fs.readFileSync(p, 'utf8');
    if (c.includes('FMT_USE_CONSTEVAL')) continue;

    if (/pod_target_xcconfig\s*=\s*\{/.test(c)) {
      // In de bestaande xcconfig-hash mengen (andere keys behouden).
      c = c.replace(
        /pod_target_xcconfig\s*=\s*\{/,
        (m) => `${m}\n      "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FMT_USE_CONSTEVAL=0",`
      );
    } else {
      // Geen xcconfig → een nieuwe toevoegen vlak na de spec-opening.
      const m = c.match(/Pod::Spec\.new do \|(\w+)\|/);
      if (!m) continue;
      const v = m[1];
      c = c.replace(
        /Pod::Spec\.new do \|\w+\|/,
        (open) => `${open}\n  ${v}.pod_target_xcconfig = { "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FMT_USE_CONSTEVAL=0" }`
      );
    }
    fs.writeFileSync(p, c);
  }
}

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      // 1) fmt.podspec patchen (node_modules bestaat al tijdens prebuild).
      try { patchFmtPodspec(cfg.modRequest.projectRoot); } catch (e) { /* niet-fataal */ }

      // 2) Podfile post_install (achteraan, zodat het niet overschreven wordt).
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /(post_install do \|installer\|[\s\S]*?)\n(  end)/,
          (full, body, endLine) => `${body}\n${PODFILE_SNIPPET}\n${endLine}`
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
