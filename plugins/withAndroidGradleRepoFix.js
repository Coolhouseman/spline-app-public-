const { withProjectBuildGradle } = require("@expo/config-plugins");

const STRIPE_VERSION = "21.22.2";
const JITPACK_REPO = "    maven { url 'https://www.jitpack.io' }";
const FILTERED_JITPACK_REPO = `    maven {
      url 'https://www.jitpack.io'
      content {
        includeGroupByRegex "com\\\\.github\\\\..*"
      }
    }`;

module.exports = function withAndroidGradleRepoFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      return config;
    }

    let { contents } = config.modResults;

    if (!contents.includes(`stripeVersion = "${STRIPE_VERSION}"`)) {
      const extBlock = `ext {
  // Pin Stripe's Android SDK to avoid dynamic-version metadata lookups during CI builds.
  stripeVersion = "${STRIPE_VERSION}"
}

`;

      if (contents.includes("allprojects {")) {
        contents = contents.replace("allprojects {", `${extBlock}allprojects {`);
      }
    }

    if (
      contents.includes(JITPACK_REPO) &&
      !contents.includes('includeGroupByRegex "com\\\\.github\\\\..*"')
    ) {
      contents = contents.replace(JITPACK_REPO, FILTERED_JITPACK_REPO);
    }

    config.modResults.contents = contents;
    return config;
  });
};
