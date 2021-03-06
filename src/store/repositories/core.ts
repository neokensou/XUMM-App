import Realm, { ObjectSchema } from 'realm';

import assign from 'lodash/assign';
import moment from 'moment';

import DeviceInfo from 'react-native-device-info';

import { SHA512, HMAC256 } from '@common/libs/crypto';

import { CoreSchema } from '@store/schemas/latest';

import Localize from '@locale';

import { NTPService } from '@services';

import BaseRepository from './base';

/* types  ==================================================================== */

// events
declare interface CoreRepository {
    on(event: 'updateSettings', listener: (settings: CoreSchema) => void): this;
    on(event: string, listener: Function): this;
}

/* repository  ==================================================================== */
class CoreRepository extends BaseRepository {
    realm: Realm;
    schema: ObjectSchema;

    initialize(realm: Realm) {
        this.realm = realm;
        this.schema = CoreSchema.schema;
    }

    saveSettings = (object: Partial<CoreSchema>) => {
        const current = this.getSettings();
        if (current) {
            this.safeWrite(() => {
                assign(current, object);

                this.emit('updateSettings', current);
            });
        } else {
            this.create(object);
        }
    };

    getSettings = (): CoreSchema => {
        const settings = Array.from(this.findAll()) as CoreSchema[];

        // settings exist
        if (settings.length > 0) {
            return settings[0];
        }

        return undefined;
    };

    private encryptedPasscode = async (passcode: string): Promise<string> => {
        // for better security we mix passcode with device uuid
        // because it will be used to encrypt private key and storing just passcode-hash is not a good idea
        const deviceUUID = DeviceInfo.getUniqueId();

        // hash the passcode
        const hashPasscode = await SHA512(passcode);
        const encPasscode = await HMAC256(hashPasscode, deviceUUID);

        return encPasscode;
    };

    setPasscode = async (passcode: string): Promise<string> => {
        // save in the store
        const encryptedPasscode = await this.encryptedPasscode(passcode);

        this.saveSettings({ passcode: encryptedPasscode });

        return encryptedPasscode;
    };

    updateTimeLastUnlocked = async () => {
        try {
            const now = await NTPService.getTime();

            this.saveSettings({
                lastUnlocked: moment(now).unix(),
            });
        } catch {
            // ignore
        }
    };

    getTimeLastUnlocked = async () => {
        /* eslint-disable-next-line */
        return new Promise(async (resolve, reject) => {
            const coreSettings = this.getSettings();

            let now;

            try {
                now = await NTPService.getTime();
            } catch {
                return reject(new Error(Localize.t('global.cannotValidateCurrentTimeWithServer')));
            }

            // lastUnlocked is not set / set it for now
            if (!coreSettings.lastUnlocked) {
                this.saveSettings({
                    lastUnlocked: moment(now).unix(),
                });
                return resolve(0);
            }

            const lastUnlocked = moment.unix(coreSettings.lastUnlocked);

            const momentNow = moment(now);
            const passedMinutes = momentNow.diff(lastUnlocked, 'minutes');

            return resolve(passedMinutes);
        });
    };

    checkPasscode = (passcode: string): Promise<string> => {
        /* eslint-disable-next-line */
        return new Promise(async (resolve, reject) => {
            let now;

            try {
                now = await NTPService.getTime();
            } catch {
                return reject(new Error(Localize.t('global.cannotValidateCurrentTimeWithServer')));
            }

            const coreSettings = this.getSettings();

            // check if attempts is exceed
            if (coreSettings.passcodeAttempts >= 5) {
                const timePassLocked = moment.unix(coreSettings.timePassLocked);
                const momentNow = moment(now);
                const passedMinutes = momentNow.diff(timePassLocked, 'minutes');

                // if passed minutes is less than 3 minutes return
                if (passedMinutes <= 3) {
                    return reject(new Error(Localize.t('global.tooManyAttemptLogin', { after: 3 - passedMinutes })));
                }
                // lock time is passed , clear attempt's
                this.saveSettings({
                    passcodeAttempts: 0,
                });
            }

            const encryptedPasscode = await this.encryptedPasscode(passcode);

            if (encryptedPasscode === coreSettings.passcode) {
                // passcode is correct , clear attempt's
                this.saveSettings({
                    passcodeAttempts: 0,
                    lastUnlocked: moment(now).unix(),
                });
                // return encrypted passcode
                return resolve(encryptedPasscode);
            }

            // passcode is incorrect
            // check should lock
            if (coreSettings.passcodeAttempts + 1 === 5) {
                // lock the app
                this.saveSettings({
                    passcodeAttempts: coreSettings.passcodeAttempts + 1,
                    timePassLocked: moment(now).unix(),
                });
            } else {
                this.saveSettings({
                    passcodeAttempts: coreSettings.passcodeAttempts + 1,
                });

                return reject(
                    new Error(
                        Localize.t('global.invalidPasscodeLeftAttempt', { left: 5 - coreSettings.passcodeAttempts }),
                    ),
                );
            }

            return reject(new Error(Localize.t('global.passcodeAttemptExceed')));
        });
    };
}

export default new CoreRepository();
