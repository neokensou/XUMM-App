/**
 * Generate Account/ConfirmSeed Screen
 */

import React, { Component } from 'react';
import { isEqual } from 'lodash';
import { SafeAreaView, View, Text, Alert } from 'react-native';

import { Prompt } from '@common/helpers';
import Localize from '@locale';
// components
import { Button, SecretNumberInput, Footer } from '@components';

import { GenerateSteps, AccountObject } from '@screens/Account/Add/Generate';

// style
import { AppStyles } from '@theme';

/* types ==================================================================== */
export interface Props {
    account: AccountObject;
    goBack: (step?: GenerateSteps, settings?: any) => void;
    goNext: (step?: GenerateSteps, settings?: any) => void;
}

export interface State {
    allFilled: boolean;
}

/* Component ==================================================================== */
class ConfirmStep extends Component<Props, State> {
    secretNumberInput: SecretNumberInput;

    constructor(props: Props) {
        super(props);

        this.state = {
            allFilled: false,
        };
    }

    goNext = () => {
        const { account, goNext } = this.props;

        const secretNumber = this.secretNumberInput.getNumbers();

        if (__DEV__) {
            goNext('ViewPublicKey');
            return;
        }

        if (isEqual(account.generatedAccount.secret.secretNumbers, secretNumber)) {
            goNext('ViewPublicKey');
        } else {
            Alert.alert('Invalid', Localize.t('account.invalidSecretNumber'));
        }
    };

    goBack = () => {
        const { goBack } = this.props;

        Prompt(
            Localize.t('global.pleaseNote'),
            Localize.t('account.goBackClearTheInput'),
            [
                {
                    text: Localize.t('global.goBack'),
                    onPress: () => {
                        goBack();
                    },
                    style: 'destructive',
                },
                { text: Localize.t('global.cancel') },
            ],
            { type: 'default' },
        );
    };

    getCurrentRow = (): number => {
        if (this.secretNumberInput) {
            return this.secretNumberInput.getCurrentRow();
        }

        return 0;
    };

    render() {
        const { allFilled } = this.state;
        const abcdefgh = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        return (
            <SafeAreaView testID="account-generate-step-view" style={[AppStyles.pageContainerFull]}>
                {this.getCurrentRow() < 8 ? (
                    <>
                        <Text style={[AppStyles.p, AppStyles.bold]}>
                            {Localize.t('account.confirmNumbersOfRow', {
                                row: abcdefgh[this.getCurrentRow()],
                            })}
                        </Text>
                        <Text style={[AppStyles.p]}>{Localize.t('account.pleaseRepeatTheNumbers')}</Text>
                    </>
                ) : (
                    <>
                        <Text style={[AppStyles.p, AppStyles.bold]}>
                            {Localize.t('account.allDoneYouCanGoToNextStepNow')}
                        </Text>
                    </>
                )}

                <View style={[AppStyles.contentContainer, AppStyles.paddingHorizontal, AppStyles.centerAligned]}>
                    <SecretNumberInput
                        ref={r => {
                            this.secretNumberInput = r;
                        }}
                        onAllFilled={filled => {
                            this.setState({
                                allFilled: filled,
                            });
                        }}
                    />
                </View>

                <Footer style={[AppStyles.row, AppStyles.centerAligned]}>
                    <View style={[AppStyles.flex3, AppStyles.paddingRightSml]}>
                        <Button
                            secondary
                            label={Localize.t('global.back')}
                            icon="IconChevronLeft"
                            onPress={this.goBack}
                        />
                    </View>
                    <View style={[AppStyles.flex5]}>
                        <Button
                            isDisabled={!__DEV__ && !allFilled}
                            label={Localize.t('global.next')}
                            onPress={this.goNext}
                            textStyle={AppStyles.strong}
                        />
                    </View>
                </Footer>
            </SafeAreaView>
        );
    }
}

/* Export Component ==================================================================== */
export default ConfirmStep;
