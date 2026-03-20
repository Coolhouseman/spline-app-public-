const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * Pins the Android Gradle wrapper to the minimum version required by AGP with
 * Android build tools 36 / compileSdk 36 (ships with EAS sdk-54 image).
 * AGP 8.9+ requires Gradle >= 8.13.
 */
const GRADLE_VERSION = "8.13";
const RELATIVE_WRAPPER_PROPERTIES = "android/gradle/wrapper/gradle-wrapper.properties";

module.exports = function withAndroidGradleVersion(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const wrapperPath = path.join(projectRoot, RELATIVE_WRAPPER_PROPERTIES);

      if (!fs.existsSync(wrapperPath)) {
        return config;
      }

      let contents = fs.readFileSync(wrapperPath, "utf8");
      // Match both -all.zip and -bin.zip (Expo/RN use -bin)
      const distributionUrlRegex = /distributionUrl=.*gradle-[\d.]+-(?:all|bin)\.zip/;
      const newUrl = `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-all.zip`;

      if (distributionUrlRegex.test(contents)) {
        contents = contents.replace(distributionUrlRegex, newUrl);
        fs.writeFileSync(wrapperPath, contents, "utf8");
      }

      return config;
    },
  ]);
};
