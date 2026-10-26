const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const WORK_MANAGER_RULES = `
# WorkManager/Room instantiate these classes through reflection.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class * extends androidx.work.InputMerger { <init>(); }
`;

module.exports = function withWorkManagerProguardRules(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const proguardPath = path.join(
                config.modRequest.platformProjectRoot,
                'app',
                'proguard-rules.pro',
            );

            const existingRules = fs.existsSync(proguardPath)
                ? fs.readFileSync(proguardPath, 'utf8')
                : '';

            if (!existingRules.includes('androidx.room.RoomDatabase')) {
                fs.appendFileSync(proguardPath, WORK_MANAGER_RULES);
            }

            return config;
        },
    ]);
};
