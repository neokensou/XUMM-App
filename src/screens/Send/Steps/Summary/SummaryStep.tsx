/**
 * Send Summary Step
 */

import { has } from 'lodash';
import BigNumber from 'bignumber.js';
import React, { Component } from 'react';
import {
    SafeAreaView,
    Animated,
    View,
    Image,
    Text,
    TextInput as RNTextInput,
    KeyboardAvoidingView,
    Alert,
    ScrollView,
    Platform,
    LayoutChangeEvent,
} from 'react-native';

import { CoreRepository } from '@store/repositories';
import { AccountSchema } from '@store/schemas/latest';

import Flag from '@common/libs/ledger/parser/common/flag';

import { Images, Prompt } from '@common/helpers';
import { NormalizeAmount, NormalizeCurrencyCode } from '@common/libs/utils';

// components
import { Button, AccordionPicker, Footer, Spacer, TextInput } from '@components';

// locale
import Localize from '@locale';

// style
import { AppStyles, AppColors } from '@theme';
import styles from './styles';

import { StepsContext } from '../../Context';

/* Component ==================================================================== */
class SummaryStep extends Component {
    gradientHeight: Animated.Value;
    amountInput: RNTextInput;
    destinationTagInput: TextInput;

    static contextType = StepsContext;
    context!: React.ContextType<typeof StepsContext>;

    constructor(props: undefined) {
        super(props);

        this.gradientHeight = new Animated.Value(0);
    }

    setGradientHeight = (event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        if (height === 0) return;
        Animated.timing(this.gradientHeight, { toValue: height }).start();
    };

    onDescriptionChange = (text: string) => {
        const { payment } = this.context;

        if (text) {
            payment.Memos = [
                {
                    data: text,
                    format: 'text/plain',
                    type: 'Description',
                },
            ];
        } else {
            payment.Memos = [];
        }
    };

    onDestinationTagChange = (text: string) => {
        const { setDestination, destination } = this.context;
        const destinationTag = text.replace(/[^0-9]/g, '');

        if (Number(destinationTag) < Number.MAX_SAFE_INTEGER) {
            Object.assign(destination, { tag: destinationTag });
        }

        setDestination(destination);
    };

    getAccountReserve = () => {
        const { currency, source } = this.context;

        // XRP
        if (typeof currency === 'string') {
            if (source.balance === 0) {
                return '';
            }
            return `(${source.accountReserve} ${Localize.t('global.reserved')})`;
        }

        return '';
    };

    getAvailableBalance = () => {
        const { currency, source } = this.context;

        let availableBalance;

        // XRP
        if (typeof currency === 'string') {
            availableBalance = source.availableBalance;
        } else {
            availableBalance = currency.balance;
        }

        return availableBalance;
    };

    onAccountChange = (item: AccountSchema) => {
        const { currency, setSource } = this.context;

        if (typeof currency === 'string') {
            setSource(item);
        } else if (item.hasCurrency(currency)) {
            setSource(item);
        } else {
            Alert.alert(Localize.t('global.error'), Localize.t('send.selectedAccountDoNotSupportCurrency'));
        }
    };

    onAmountChange = (amount: string) => {
        const { setAmount } = this.context;
        const sendAmount = NormalizeAmount(amount);

        // set amount
        setAmount(sendAmount);
    };

    showMemoAlert = () => {
        const { payment } = this.context;

        const coreSettings = CoreRepository.getSettings();

        if (coreSettings.showMemoAlert && payment.Memos) {
            Prompt(
                Localize.t('global.pleaseNote'),
                Localize.t('send.memoPublicWarning'),
                [
                    {
                        text: Localize.t('global.doNotRemindMe'),
                        onPress: () => {
                            CoreRepository.saveSettings({
                                showMemoAlert: false,
                            });
                        },
                        style: 'destructive',
                    },
                    { text: Localize.t('global.dismiss') },
                ],
                { type: 'default' },
            );
        }
    };

    renderAccountItem = (account: AccountSchema, selected: boolean) => {
        return (
            <View style={[styles.pickerItem]}>
                <Text style={[styles.pickerItemTitle, selected ? AppStyles.colorBlue : AppStyles.colorBlack]}>
                    {account.label}
                </Text>
                <Text
                    style={[styles.pickerItemSub, selected ? AppStyles.colorBlue : AppStyles.colorGreyDark]}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                >
                    {account.address}
                </Text>
            </View>
        );
    };

    renderCurrencyItem = (item: any) => {
        // XRP
        if (typeof item === 'string') {
            return (
                <View style={[styles.pickerItem]}>
                    <View style={[AppStyles.row, AppStyles.centerAligned]}>
                        <View style={[styles.xrpAvatarContainer]}>
                            <Image style={[styles.xrpAvatar]} source={Images.IconXrp} />
                        </View>
                        <View style={[AppStyles.column, AppStyles.centerContent]}>
                            <Text style={[styles.currencyItemLabel]}>XRP</Text>
                            <Text style={[styles.currencyBalance]}>
                                {Localize.t('global.balance')}: {this.getAvailableBalance()} {this.getAccountReserve()}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.pickerItem]}>
                <View style={[AppStyles.row, AppStyles.centerAligned]}>
                    <View style={[styles.brandAvatarContainer]}>
                        <Image style={[styles.brandAvatar]} source={{ uri: item.counterParty.avatar }} />
                    </View>
                    <View style={[AppStyles.column, AppStyles.centerContent]}>
                        <Text style={[styles.currencyItemLabel]}>
                            {NormalizeCurrencyCode(item.currency.currency)}

                            <Text style={[AppStyles.subtext]}> - {item.currency.name}</Text>
                        </Text>
                        <Text style={[styles.currencyBalance]}>
                            {Localize.t('global.balance')}: {item.balance}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    goNext = () => {
        const { goNext, currency, source, amount, destination, destinationInfo } = this.context;

        const bAmount = new BigNumber(amount);

        if (source.balance === 0) {
            Alert.alert(Localize.t('global.error'), Localize.t('account.accountIsNotActivated'));
            return;
        }

        const availableBalance = this.getAvailableBalance();

        // check if amount is bigger than what user can spend
        if (bAmount.toNumber() > availableBalance) {
            Alert.alert(
                Localize.t('global.error'),
                Localize.t('send.amountIsBiggerThanYourSpend', { spendable: availableBalance }),
            );
            return;
        }

        // check if balance can cover the transfer fee for non XRP currencies
        if (typeof currency !== 'string') {
            const rate = new BigNumber(currency.transfer_rate)
                .dividedBy(1000000)
                .minus(1000)
                .dividedBy(10);

            const fee = bAmount
                .multipliedBy(rate)
                .dividedBy(100)
                .decimalPlaces(6);
            const after = bAmount.plus(fee).toNumber();

            if (after > availableBalance) {
                Alert.alert(Localize.t('global.error'), Localize.t('send.balanceIsNotEnoughForFee', { fee }));
                return;
            }
        }

        // check if destination requires the destination tag
        if (!has(destinationInfo, 'error') && has(destinationInfo, ['account_data', 'Flags'])) {
            const { account_data } = destinationInfo;
            const accountFlags = new Flag('Account', account_data.Flags).parse();

            if (accountFlags.requireDestinationTag && !destination.tag) {
                Alert.alert(Localize.t('global.warning'), Localize.t('send.destinationTagIsRequired'));
                this.destinationTagInput.focus();
                return;
            }
        }

        // go to next screen
        goNext();
    };

    goBack = () => {
        const { goBack, setDestination } = this.context;

        // clear destination
        setDestination(undefined);

        goBack();
    };

    render() {
        const { source, accounts, amount, destination, currency } = this.context;

        return (
            <SafeAreaView testID="send-summary-view" style={[styles.container]}>
                <KeyboardAvoidingView
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 130 : 0}
                    behavior="padding"
                    style={[AppStyles.flex1, AppStyles.stretchSelf]}
                >
                    <ScrollView style={[AppStyles.flex1]}>
                        <View onLayout={this.setGradientHeight} style={[styles.rowItem, styles.rowItemGrey]}>
                            <Animated.Image
                                source={Images.SideGradient}
                                style={[styles.gradientImage, { height: this.gradientHeight }]}
                                resizeMode="stretch"
                            />
                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.from')} :
                                </Text>
                            </View>
                            <AccordionPicker
                                onSelect={this.onAccountChange}
                                items={accounts}
                                renderItem={this.renderAccountItem}
                                selectedItem={source}
                                keyExtractor={i => i.address}
                                containerStyle={{ backgroundColor: AppColors.transparent }}
                            />
                            <Spacer size={20} />

                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.to')} :
                                </Text>
                            </View>
                            <Spacer size={15} />

                            {/* eslint-disable-next-line */}
                            <View style={[{ paddingLeft: 10 }]}>
                                <View style={[styles.pickerItem]}>
                                    <Text style={[styles.pickerItemTitle]}>{destination.name}</Text>
                                    <Text
                                        style={[styles.pickerItemSub, AppStyles.colorGreyDark]}
                                        adjustsFontSizeToFit
                                        numberOfLines={1}
                                    >
                                        {destination.address}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Currency */}
                        <View style={[styles.rowItem]}>
                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.currency')} :
                                </Text>
                            </View>
                            <Spacer size={15} />

                            {/* eslint-disable-next-line */}
                            <View style={[{ paddingLeft: 10 }]}>{this.renderCurrencyItem(currency)}</View>
                        </View>

                        {/* Amount */}
                        <View style={[styles.rowItem]}>
                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.amount')}:
                                </Text>
                            </View>
                            <Spacer size={15} />

                            <View style={AppStyles.row}>
                                <View style={AppStyles.flex1}>
                                    <RNTextInput
                                        ref={r => {
                                            this.amountInput = r;
                                        }}
                                        keyboardType="decimal-pad"
                                        onChangeText={this.onAmountChange}
                                        returnKeyType="done"
                                        placeholder="0"
                                        style={[styles.amountInput]}
                                        value={amount}
                                    />
                                </View>
                                <Button
                                    onPress={() => {
                                        this.amountInput.focus();
                                    }}
                                    style={styles.editButton}
                                    roundedSmall
                                    iconSize={13}
                                    light
                                    icon="IconEdit"
                                />
                            </View>
                        </View>

                        {/* destination tag */}
                        <View style={[styles.rowItem]}>
                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.destinationTag')}:
                                </Text>
                            </View>
                            <Spacer size={15} />
                            <TextInput
                                ref={r => {
                                    this.destinationTagInput = r;
                                }}
                                value={destination.tag?.toString()}
                                onChangeText={this.onDestinationTagChange}
                                placeholder={Localize.t('send.enterDestinationTag')}
                                inputStyle={styles.inputStyle}
                                keyboardType="number-pad"
                                returnKeyType="done"
                            />
                        </View>

                        {/* Desc */}
                        <View style={[styles.rowItem]}>
                            <View style={[styles.rowTitle]}>
                                <Text style={[AppStyles.subtext, AppStyles.strong, { color: AppColors.greyDark }]}>
                                    {Localize.t('global.memo')}:
                                </Text>
                            </View>
                            <Spacer size={15} />
                            <TextInput
                                onBlur={this.showMemoAlert}
                                onChangeText={this.onDescriptionChange}
                                placeholder={Localize.t('send.enterPublicMemo')}
                                inputStyle={styles.inputStyle}
                                maxLength={20}
                                returnKeyType="done"
                            />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
                {/* Bottom Bar */}
                <Footer style={[AppStyles.row]}>
                    <View style={[AppStyles.flex1, AppStyles.paddingRightSml]}>
                        <Button secondary label={Localize.t('global.back')} onPress={this.goBack} />
                    </View>
                    <View style={[AppStyles.flex2]}>
                        <Button textStyle={AppStyles.strong} label={Localize.t('global.send')} onPress={this.goNext} />
                    </View>
                </Footer>
            </SafeAreaView>
        );
    }
}

/* Export Component ==================================================================== */
export default SummaryStep;
