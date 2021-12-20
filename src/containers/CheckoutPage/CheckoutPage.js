import React, { Component } from 'react';
import { bool, func, instanceOf, object, oneOfType, shape, string } from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import config from '../../config';
import routeConfiguration from '../../routeConfiguration';
import { pathByRouteName, findRouteByRouteName } from '../../util/routes';
import { propTypes, LINE_ITEM_NIGHT, LINE_ITEM_DAY, DATE_TYPE_DATE } from '../../util/types';
import {
  ensureListing,
  ensureCurrentUser,
  ensureUser,
  ensureTransaction,
  ensureBooking,
  ensureStripeCustomer,
  ensurePaymentMethodCard,
} from '../../util/data';
import { dateFromLocalToAPI, minutesBetween } from '../../util/dates';
import { createSlug } from '../../util/urlHelpers';
import {
  isTransactionInitiateAmountTooLowError,
  isTransactionInitiateListingNotFoundError,
  isTransactionInitiateMissingStripeAccountError,
  isTransactionInitiateBookingTimeNotAvailableError,
  isTransactionChargeDisabledError,
  isTransactionZeroPaymentError,
  transactionInitiateOrderStripeErrors,
} from '../../util/errors';
import { formatMoney } from '../../util/currency';
import { TRANSITION_ENQUIRE, txIsPaymentPending, txIsPaymentExpired } from '../../util/transaction';
import {
  AvatarMedium,
  BookingBreakdown,
  Logo,
  NamedLink,
  NamedRedirect,
  Page,
  PrimaryButton,
  ResponsiveImage,
} from '../../components';
import { StripePaymentForm } from '../../forms';
import { isScrollingDisabled } from '../../ducks/UI.duck';
import { confirmCardPayment, retrievePaymentIntent } from '../../ducks/stripe.duck';
import { savePaymentMethod } from '../../ducks/paymentMethods.duck';

import {
  initiateOrder,
  setInitialValues,
  speculateTransaction,
  stripeCustomer,
  confirmPayment,
  sendMessage,
  createRecurring,
} from './CheckoutPage.duck';
import { storeData, storedData, clearData } from './CheckoutPageSessionHelpers';
import css from './CheckoutPage.module.css';
import { getPropByName } from '../../util/userHelpers';
import moment from 'moment';

const STORAGE_KEY = 'CheckoutPage';

// Stripe PaymentIntent statuses, where user actions are already completed
// https://stripe.com/docs/payments/payment-intents/status
const STRIPE_PI_USER_ACTIONS_DONE_STATUSES = ['processing', 'requires_capture', 'succeeded'];

// Payment charge options
const ONETIME_PAYMENT = 'ONETIME_PAYMENT';
const PAY_AND_SAVE_FOR_LATER_USE = 'PAY_AND_SAVE_FOR_LATER_USE';
const USE_SAVED_CARD = 'USE_SAVED_CARD';

const paymentFlow = (selectedPaymentMethod, saveAfterOnetimePayment) => {
  // Payment mode could be 'replaceCard', but without explicit saveAfterOnetimePayment flag,
  // we'll handle it as one-time payment
  return selectedPaymentMethod === 'defaultCard'
    ? USE_SAVED_CARD
    : saveAfterOnetimePayment
    ? PAY_AND_SAVE_FOR_LATER_USE
    : ONETIME_PAYMENT;
};

const initializeOrderPage = (initialValues, routes, dispatch) => {
  const OrderPage = findRouteByRouteName('OrderDetailsPage', routes);
  console.log(1111);
  // Transaction is already created, but if the initial message
  // sending failed, we tell it to the OrderDetailsPage.
  dispatch(OrderPage.setInitialValues(initialValues));
  console.log(2222);
};

const checkIsPaymentExpired = existingTransaction => {
  return txIsPaymentExpired(existingTransaction)
    ? true
    : txIsPaymentPending(existingTransaction)
    ? minutesBetween(existingTransaction.attributes.lastTransitionedAt, new Date()) >= 15
    : false;
};

export class CheckoutPageComponent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      pageData: {},
      dataLoaded: false,
      submitting: false,
    };
    this.stripe = null;

    this.onStripeInitialized = this.onStripeInitialized.bind(this);
    this.loadInitialData = this.loadInitialData.bind(this);
    this.handlePaymentIntent = this.handlePaymentIntent.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentDidMount() {
    if (window) {
      this.loadInitialData();
    }
  }

  /**
   * Load initial data for the page
   *
   * Since the data for the checkout is not passed in the URL (there
   * might be lots of options in the future), we must pass in the data
   * some other way. Currently the ListingPage sets the initial data
   * for the CheckoutPage's Redux store.
   *
   * For some cases (e.g. a refresh in the CheckoutPage), the Redux
   * store is empty. To handle that case, we store the received data
   * to window.sessionStorage and read it from there if no props from
   * the store exist.
   *
   * This function also sets of fetching the speculative transaction
   * based on this initial data.
   */
  loadInitialData() {
    const {
      bookingData,
      bookingDates,
      listing,
      transaction,
      fetchSpeculatedTransaction,
      fetchStripeCustomer,
      history,
    } = this.props;
    console.log(
      '🚀 | file: CheckoutPage.js | line 149 | CheckoutPageComponent | loadInitialData | this.props',
      this.props
    );

    // Fetch currentUser with stripeCustomer entity
    // Note: since there's need for data loading in "componentWillMount" function,
    //       this is added here instead of loadData static function.
    fetchStripeCustomer();

    // Browser's back navigation should not rewrite data in session store.
    // Action is 'POP' on both history.back() and page refresh cases.
    // Action is 'PUSH' when user has directed through a link
    // Action is 'REPLACE' when user has directed through login/signup process
    const hasNavigatedThroughLink = history.action === 'PUSH' || history.action === 'REPLACE';

    const hasDataInProps = !!(bookingData && bookingDates && listing) && hasNavigatedThroughLink;
    if (hasDataInProps) {
      // Store data only if data is passed through props and user has navigated through a link.
      storeData(bookingData, bookingDates, listing, transaction, STORAGE_KEY);
    }

    // NOTE: stored data can be empty if user has already successfully completed transaction.
    const pageData = hasDataInProps
      ? { bookingData, bookingDates, listing, transaction }
      : storedData(STORAGE_KEY);

    // Check if a booking is already created according to stored data.
    const tx = pageData ? pageData.transaction : null;
    const isBookingCreated = tx && tx.booking && tx.booking.id;

    const shouldFetchSpeculatedTransaction =
      pageData &&
      pageData.listing &&
      pageData.listing.id &&
      pageData.bookingData &&
      pageData.bookingDates &&
      pageData.bookingDates.bookingStart &&
      pageData.bookingDates.bookingEnd &&
      !isBookingCreated;

    if (shouldFetchSpeculatedTransaction) {
      const listingId = pageData.listing.id;
      const transactionId = tx ? tx.id : null;
      const { bookingStart, bookingEnd } = pageData.bookingDates;

      // Convert picked date to date that will be converted on the API as
      // a noon of correct year-month-date combo in UTC
      const bookingStartForAPI = dateFromLocalToAPI(bookingStart);
      const bookingEndForAPI = dateFromLocalToAPI(bookingEnd);

      // Fetch speculated transaction for showing price in booking breakdown
      // NOTE: if unit type is line-item/units, quantity needs to be added.
      // The way to pass it to checkout page is through pageData.bookingData
      fetchSpeculatedTransaction(
        {
          listingId,
          bookingStart: bookingStartForAPI,
          bookingEnd: bookingEndForAPI,
        },
        transactionId
      );
    }

    this.setState({ pageData: pageData || {}, dataLoaded: true });
  }

  handlePaymentIntent(handlePaymentParams) {
    const {
      currentUser,
      stripeCustomerFetched,
      onInitiateOrder,
      onConfirmCardPayment,
      onConfirmPayment,
      onSendMessage,
      onSavePaymentMethod,
      listing,
      transaction,
      bookingData,
      bookingDates,
      onCreateRecurring,
    } = this.props;
    const {
      pageData,
      speculatedTransaction,
      message,
      paymentIntent,
      selectedPaymentMethod,
      saveAfterOnetimePayment,
      createRecurringParams,
    } = handlePaymentParams;
    console.log(
      '🚀 | file: CheckoutPage.js | line 239 | CheckoutPageComponent | handlePaymentIntent | recurringCallbackParams',
      createRecurringParams
    );
    console.log(
      '🚀 | file: CheckoutPage.js | line 237 | CheckoutPageComponent | handlePaymentIntent | handlePaymentParams',
      handlePaymentParams
    );
    const storedTx = ensureTransaction(transaction);
    const ensuredCurrentUser = ensureCurrentUser(currentUser);
    const ensuredStripeCustomer = ensureStripeCustomer(ensuredCurrentUser.stripeCustomer);
    const ensuredDefaultPaymentMethod = ensurePaymentMethodCard(
      ensuredStripeCustomer.defaultPaymentMethod
    );

    let createdPaymentIntent = null;

    const hasDefaultPaymentMethod = !!(
      stripeCustomerFetched &&
      ensuredStripeCustomer.attributes.stripeCustomerId &&
      ensuredDefaultPaymentMethod.id
    );
    const stripePaymentMethodId = hasDefaultPaymentMethod
      ? ensuredDefaultPaymentMethod.attributes.stripePaymentMethodId
      : null;
    const selectedPaymentFlow = paymentFlow(selectedPaymentMethod, saveAfterOnetimePayment);

    // Step 1: initiate order by requesting payment from Marketplace API
    const fnRequestPayment = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 257 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      // fnParams should be { listingId, bookingStart, bookingEnd }
      const hasPaymentIntents =
        storedTx.attributes.protectedData && storedTx.attributes.protectedData.stripePaymentIntents;

      // If paymentIntent exists, order has been initiated previously.
      return hasPaymentIntents ? Promise.resolve(storedTx) : onInitiateOrder(fnParams, storedTx.id);
    };

    // Step 2: pay using Stripe SDK
    const fnConfirmCardPayment = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 268 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      // fnParams should be returned transaction entity
      const { recurringResponse, ...transaction } = fnParams;
      const order = ensureTransaction(transaction);
      if (order.id) {
        // Store order.

        // const { bookingData, bookingDates, listing } = pageData;
        storeData(bookingData, bookingDates, listing, order, STORAGE_KEY, recurringResponse);
        this.setState({ pageData: { ...pageData, transaction: order, recurringResponse } });
      }

      const hasPaymentIntents =
        order.attributes.protectedData && order.attributes.protectedData.stripePaymentIntents;

      if (!hasPaymentIntents) {
        throw new Error(
          `Missing StripePaymentIntents key in transaction's protectedData. Check that your transaction process is configured to use payment intents.`
        );
      }

      const { stripePaymentIntentClientSecret } = hasPaymentIntents
        ? order.attributes.protectedData.stripePaymentIntents.default
        : null;

      const { stripe, card, billingDetails, paymentIntent } = handlePaymentParams;
      const stripeElementMaybe = selectedPaymentFlow !== USE_SAVED_CARD ? { card } : {};
      console.log(
        '🚀 | file: CheckoutPage.js | line 301 | CheckoutPageComponent | handlePaymentIntent | stripeElementMaybe',
        stripeElementMaybe
      );

      // Note: payment_method could be set here for USE_SAVED_CARD flow.
      // { payment_method: stripePaymentMethodId }
      // However, we have set it already on API side, when PaymentIntent was created.
      const paymentParams =
        selectedPaymentFlow !== USE_SAVED_CARD
          ? {
              payment_method: {
                billing_details: billingDetails,
                card: card,
              },
            }
          : {};

      const params = {
        stripePaymentIntentClientSecret,
        orderId: order.id,
        stripe,
        ...stripeElementMaybe,
        paymentParams,
        recurringResponse,
      };

      // If paymentIntent status is not waiting user action,
      // confirmCardPayment has been called previously.
      const hasPaymentIntentUserActionsDone =
        paymentIntent && STRIPE_PI_USER_ACTIONS_DONE_STATUSES.includes(paymentIntent.status);
      return hasPaymentIntentUserActionsDone
        ? Promise.resolve({ transactionId: order.id, paymentIntent })
        : onConfirmCardPayment(params);
    };

    // Step 3: complete order by confirming payment to Marketplace API
    // Parameter should contain { paymentIntent, transactionId } returned in step 2
    const fnConfirmPayment = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 318 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      createdPaymentIntent = fnParams.paymentIntent;
      return onConfirmPayment({ ...fnParams, transactionId: transaction.id })
        .then(confirmResponse => {
          return confirmResponse;
        })
        .catch(e => {
          console.log(
            '🚀 | file: CheckoutPage.js | line 356 | CheckoutPageComponent | handlePaymentIntent | e',
            e
          );
        });
    };
    // Step 3: optionally save card as defaultPaymentMethod
    const fnSavePaymentMethod = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 345 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      const pi = createdPaymentIntent || paymentIntent;
      console.log(
        '🚀 | file: CheckoutPage.js | line 377 | CheckoutPageComponent | handlePaymentIntent | paymentIntent',
        paymentIntent
      );
      console.log(
        '🚀 | file: CheckoutPage.js | line 377 | CheckoutPageComponent | handlePaymentIntent | createdPaymentIntent',
        createdPaymentIntent
      );
      console.log(
        '🚀 | file: CheckoutPage.js | line 377 | CheckoutPageComponent | handlePaymentIntent | pi',
        pi
      );
      return onSavePaymentMethod(ensuredStripeCustomer, pi.payment_method)
        .then(response => {
          if (response.errors) {
            return { ...fnParams, paymentMethodSaved: false };
          }
          return { ...fnParams, paymentMethodSaved: true };
        })
        .catch(e => {
          // Real error cases are catched already in paymentMethods page.
          return { ...fnParams, paymentMethodSaved: false };
        });
    };

    const fnCreateRecurring = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 269 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      return onCreateRecurring({ ...createRecurringParams, paymentMethod: pi.payment_method })
        .then(recurringResponse => {
          console.log(
            '🚀 | file: CheckoutPage.js | line 281 | CheckoutPageComponent | onCreateRecurring | recurringResponse',
            recurringResponse
          );
          return { ...fnParams, protectedData: { recurringResponse } };
        })
        .catch(e => {
          console.log(e);
        });
    };
    // Step 4: send initial message
    const fnSendMessage = fnParams => {
      console.log(
        '🚀 | file: CheckoutPage.js | line 339 | CheckoutPageComponent | handlePaymentIntent | fnParams',
        fnParams
      );
      return onSendMessage({ ...fnParams, message });
    };

    // Here we create promise calls in sequence
    // This is pretty much the same as:
    // fnRequestPayment({...initialParams})
    //   .then(result => fnConfirmCardPayment({...result}))
    //   .then(result => fnConfirmPayment({...result}))
    const applyAsync = (acc, val) => acc.then(val);
    const composeAsync = (...funcs) => x => funcs.reduce(applyAsync, Promise.resolve(x));
    const handlePaymentIntentCreation = composeAsync(
      fnRequestPayment,
      fnConfirmCardPayment,
      fnConfirmPayment,
      fnSavePaymentMethod,
      fnCreateRecurring,
      fnSendMessage
    );

    // Create order aka transaction
    // NOTE: if unit type is line-item/units, quantity needs to be added.
    // The way to pass it to checkout page is through pageData.bookingData
    const tx = speculatedTransaction ? speculatedTransaction : storedTx;

    // Note: optionalPaymentParams contains Stripe paymentMethod,
    // but that can also be passed on Step 2
    // stripe.confirmCardPayment(stripe, { payment_method: stripePaymentMethodId })
    const optionalPaymentParams =
      selectedPaymentFlow === USE_SAVED_CARD && hasDefaultPaymentMethod
        ? { paymentMethod: stripePaymentMethodId }
        : selectedPaymentFlow === PAY_AND_SAVE_FOR_LATER_USE
        ? { setupPaymentMethodForSaving: true }
        : {};

    const orderParams = {
      listingId: listing.id,
      bookingStart: tx.booking.attributes.start,
      bookingEnd: tx.booking.attributes.end,
      ...optionalPaymentParams,
    };

    return handlePaymentIntentCreation(orderParams);
  }

  handleSubmit(values) {
    if (this.state.submitting) {
      return;
    }
    this.setState({ submitting: true });

    const {
      history,
      speculatedTransaction,
      currentUser: user,
      paymentIntent,
      dispatch,
      listing,
      transaction,
      onCreateRecurring,
      bookingDates,
    } = this.props;
    console.log(
      '🚀 | file: CheckoutPage.js | line 469 | CheckoutPageComponent | handleSubmit | bookingDates',
      bookingDates
    );
    const { card, message, paymentMethod, formValues } = values;
    console.log(
      '🚀 | file: CheckoutPage.js | line 454 | CheckoutPageComponent | handleSubmit | values',
      values
    );
    const { name, addressLine1, addressLine2, postal, city, state, country } = formValues;
    const saveAfterOnetimePayment = true;
    const currentUser = ensureCurrentUser(user);
    console.log(
      '🚀 | file: CheckoutPage.js | line 469 | CheckoutPageComponent | handleSubmit | currentUser',
      currentUser
    );
    const tx = ensureTransaction(transaction);
    // Billing address is recommended.
    // However, let's not assume that <StripePaymentAddress> data is among formValues.
    // Read more about this from Stripe's docs
    // https://stripe.com/docs/stripe-js/reference#stripe-handle-card-payment-no-element
    const addressMaybe =
      addressLine1 && postal
        ? {
            address: {
              city: city,
              country: country,
              line1: addressLine1,
              line2: addressLine2,
              postal_code: postal,
              state: state,
            },
          }
        : {};
    const billingDetails = {
      name,
      email: ensureCurrentUser(currentUser).attributes.email,
      ...addressMaybe,
    };
    const currentListing = ensureListing(listing);
    const currentAuthor = ensureUser(currentListing.author);
    const price = currentListing.attributes.price;
    const recurringPaymentMethod =
      paymentMethod === 'defaultCard' ? getPropByName(currentUser, 'stripePaymentMethodId') : null;
    console.log(
      '🚀 | file: CheckoutPage.js | line 532 | CheckoutPageComponent | handleSubmit | bookingDates',
      bookingDates
    );
    const ongoingContract = tx.attributes?.protectedData?.ongoingContract;
    console.log(
      '🚀 | file: CheckoutPage.js | line 531 | CheckoutPageComponent | handleSubmit | tx',
      tx
    );
    console.log(
      '🚀 | file: CheckoutPage.js | line 531 | CheckoutPageComponent | handleSubmit | ongoingContract',
      ongoingContract
    );
    const createRecurringParams = {
      weeklyAmount: price?.amount,
      listingId: currentListing?.id?.uuid,
      stripeCustomerId: currentUser?.stripeCustomer?.attributes?.stripeCustomerId,
      providerUserId: currentAuthor.id,
      paymentMethod: recurringPaymentMethod,
      transactionId: tx?.id?.uuid,
      lengthOfContract: getPropByName(transaction, 'lengthOfContract'),
      startTimestamp: moment(bookingDates.bookingStart)
        .add({ days: 6, hours: 23, minutes: 59 })
        .unix(),
      endTimestamp: moment(bookingDates.bookingEnd)
        .subtract({ days: 6, hours: 23, minutes: 59 })
        .unix(),
      // transaction: tx,
      ongoingContract,
    };
    console.log(
      '🚀 | file: CheckoutPage.js | line 515 | CheckoutPageComponent | handleSubmit | createRecurringParams',
      createRecurringParams
    );
    const requestPaymentParams = {
      pageData: this.state.pageData,
      speculatedTransaction,
      stripe: this.stripe,
      card,
      billingDetails,
      message,
      paymentIntent,
      selectedPaymentMethod: paymentMethod,
      saveAfterOnetimePayment: !!saveAfterOnetimePayment,
      createRecurringParams,
    };
    console.log(
      '🚀 | file: CheckoutPage.js | line 528 | CheckoutPageComponent | handleSubmit | requestPaymentParams',
      requestPaymentParams
    );
    console.log(
      '🚀 | file: CheckoutPage.js | line 514 | CheckoutPageComponent | handleSubmit | requestPaymentParams',
      requestPaymentParams
    );
    this.handlePaymentIntent(requestPaymentParams)
      .then(res => {
        console.log(
          '🚀 | file: CheckoutPage.js | line 514 | CheckoutPageComponent | handleSubmit | res',
          res
        );
        const { orderId, messageSuccess, paymentMethodSaved } = res;
        this.setState({ submitting: false });

        const routes = routeConfiguration();
        const initialMessageFailedToTransaction = messageSuccess ? null : orderId;
        const orderDetailsPath = pathByRouteName('OrderDetailsPage', routes, { id: orderId.uuid });
        const initialValues = {
          initialMessageFailedToTransaction,
          savePaymentMethodFailed: !paymentMethodSaved,
        };

        initializeOrderPage(initialValues, routes, dispatch);
        clearData(STORAGE_KEY);
        history.push(orderDetailsPath);
      })
      .catch(err => {
        console.error(err);
        this.setState({ submitting: false });
      });
  }

  onStripeInitialized(stripe) {
    this.stripe = stripe;

    const { paymentIntent, onRetrievePaymentIntent } = this.props;
    const tx = this.state.pageData ? this.state.pageData.transaction : null;

    // We need to get up to date PI, if booking is created but payment is not expired.
    const shouldFetchPaymentIntent =
      this.stripe &&
      !paymentIntent &&
      tx &&
      tx.id &&
      tx.booking &&
      tx.booking.id &&
      txIsPaymentPending(tx) &&
      !checkIsPaymentExpired(tx);

    if (shouldFetchPaymentIntent) {
      const { stripePaymentIntentClientSecret } =
        tx.attributes.protectedData && tx.attributes.protectedData.stripePaymentIntents
          ? tx.attributes.protectedData.stripePaymentIntents.default
          : {};

      // Fetch up to date PaymentIntent from Stripe
      onRetrievePaymentIntent({ stripe, stripePaymentIntentClientSecret });
    }
  }

  render() {
    const {
      scrollingDisabled,
      speculateTransactionInProgress,
      speculateTransactionError,
      speculatedTransaction: speculatedTransactionMaybe,
      initiateOrderError,
      confirmPaymentError,
      intl,
      params,
      currentUser,
      confirmCardPaymentError,
      paymentIntent,
      retrievePaymentIntentError,
      stripeCustomerFetched,
      listing,
      bookingDates,
      transaction,
      onCreateRecurring,
    } = this.props;
    console.log(
      '🚀 | file: CheckoutPage.js | line 517 | CheckoutPageComponent | render | this.props',
      this.props
    );

    // Since the listing data is already given from the ListingPage
    // and stored to handle refreshes, it might not have the possible
    // deleted or closed information in it. If the transaction
    // initiate or the speculative initiate fail due to the listing
    // being deleted or closec, we should dig the information from the
    // errors and not the listing data.
    const listingNotFound =
      isTransactionInitiateListingNotFoundError(speculateTransactionError) ||
      isTransactionInitiateListingNotFoundError(initiateOrderError);

    const isLoading = !this.state.dataLoaded || speculateTransactionInProgress;

    const existingTransaction = ensureTransaction(transaction);
    const speculatedTransaction = ensureTransaction(speculatedTransactionMaybe, {}, null);
    const currentListing = ensureListing(listing);
    console.log(
      '🚀 | file: CheckoutPage.js | line 535 | CheckoutPageComponent | render | currentListing',
      currentListing
    );
    const currentAuthor = ensureUser(currentListing.author);

    const listingTitle = currentListing.attributes.title;
    const title = intl.formatMessage({ id: 'CheckoutPage.title' }, { listingTitle });

    const pageProps = { title, scrollingDisabled };
    const topbar = (
      <div className={css.topbar}>
        <NamedLink className={css.home} name="LandingPage">
          <Logo
            className={css.logoMobile}
            title={intl.formatMessage({ id: 'CheckoutPage.goToLandingPage' })}
            format="mobile"
          />
          <Logo
            className={css.logoDesktop}
            alt={intl.formatMessage({ id: 'CheckoutPage.goToLandingPage' })}
            format="desktop"
          />
        </NamedLink>
      </div>
    );

    if (isLoading) {
      return <Page {...pageProps}>{topbar}</Page>;
    }

    const isOwnListing =
      currentUser &&
      currentUser.id &&
      currentAuthor &&
      currentAuthor.id &&
      currentAuthor.id.uuid === currentUser.id.uuid;

    const hasListingAndAuthor = !!(currentListing.id && currentAuthor.id);
    console.log(
      '🚀 | file: CheckoutPage.js | line 562 | CheckoutPageComponent | render | currentAuthor',
      currentAuthor
    );
    console.log(
      '🚀 | file: CheckoutPage.js | line 562 | CheckoutPageComponent | render | currentListing',
      currentListing
    );
    const hasBookingDates = !!(
      bookingDates &&
      bookingDates.bookingStart &&
      bookingDates.bookingEnd
    );
    const hasRequiredData = hasListingAndAuthor && hasBookingDates;
    const canShowPage = hasRequiredData && !isOwnListing;
    const shouldRedirect = !isLoading && !canShowPage;

    // Redirect back to ListingPage if data is missing.
    // Redirection must happen before any data format error is thrown (e.g. wrong currency)
    if (shouldRedirect) {
      // eslint-disable-next-line no-console
      console.error('Missing or invalid data for checkout, redirecting back to transaction page.', {
        transaction: speculatedTransaction,
        bookingDates,
        listing,
      });
      console.log(
        '🚀 | file: CheckoutPage.js | line 615 | CheckoutPageComponent | render | params',
        params
      );
      return <NamedRedirect name="OrderPage" params={params} />;
    }

    // Show breakdown only when speculated transaction and booking are loaded
    // (i.e. have an id)
    const tx = existingTransaction.booking ? existingTransaction : speculatedTransaction;
    console.log(
      '🚀 | file: CheckoutPage.js | line 666 | CheckoutPageComponent | render | speculatedTransaction',
      speculatedTransaction
    );
    console.log(
      '🚀 | file: CheckoutPage.js | line 666 | CheckoutPageComponent | render | existingTransaction',
      existingTransaction
    );
    const txBooking = ensureBooking(tx.booking);
    const breakdown =
      tx.id && txBooking.id ? (
        <BookingBreakdown
          className={css.bookingBreakdown}
          userRole="customer"
          unitType={config.bookingUnitType}
          transaction={tx}
          booking={txBooking}
          dateType={DATE_TYPE_DATE}
        />
      ) : null;

    const isPaymentExpired = checkIsPaymentExpired(existingTransaction);
    const hasDefaultPaymentMethod = !!(
      stripeCustomerFetched &&
      ensureStripeCustomer(currentUser.stripeCustomer).attributes.stripeCustomerId &&
      ensurePaymentMethodCard(currentUser.stripeCustomer.defaultPaymentMethod).id
    );

    // Allow showing page when currentUser is still being downloaded,
    // but show payment form only when user info is loaded.
    const showPaymentForm = !!(
      currentUser &&
      hasRequiredData &&
      !listingNotFound &&
      !initiateOrderError &&
      !speculateTransactionError &&
      !retrievePaymentIntentError &&
      !isPaymentExpired
    );

    const firstImage =
      currentListing.images && currentListing.images.length > 0 ? currentListing.images[0] : null;

    const listingLink = (
      <NamedLink
        name="ListingPage"
        params={{ id: currentListing.id.uuid, slug: createSlug(listingTitle) }}
      >
        <FormattedMessage id="CheckoutPage.errorlistingLinkText" />
      </NamedLink>
    );

    const isAmountTooLowError = isTransactionInitiateAmountTooLowError(initiateOrderError);
    const isChargeDisabledError = isTransactionChargeDisabledError(initiateOrderError);
    const isBookingTimeNotAvailableError = isTransactionInitiateBookingTimeNotAvailableError(
      initiateOrderError
    );
    const stripeErrors = transactionInitiateOrderStripeErrors(initiateOrderError);

    let initiateOrderErrorMessage = null;
    let listingNotFoundErrorMessage = null;

    if (listingNotFound) {
      listingNotFoundErrorMessage = (
        <p className={css.notFoundError}>
          <FormattedMessage id="CheckoutPage.listingNotFoundError" />
        </p>
      );
    } else if (isAmountTooLowError) {
      initiateOrderErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.initiateOrderAmountTooLow" />
        </p>
      );
    } else if (isBookingTimeNotAvailableError) {
      initiateOrderErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.bookingTimeNotAvailableMessage" />
        </p>
      );
    } else if (isChargeDisabledError) {
      initiateOrderErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.chargeDisabledMessage" />
        </p>
      );
    } else if (stripeErrors && stripeErrors.length > 0) {
      // NOTE: Error messages from Stripes are not part of translations.
      // By default they are in English.
      const stripeErrorsAsString = stripeErrors.join(', ');
      initiateOrderErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage
            id="CheckoutPage.initiateOrderStripeError"
            values={{ stripeErrors: stripeErrorsAsString }}
          />
        </p>
      );
    } else if (initiateOrderError) {
      // Generic initiate order error
      initiateOrderErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.initiateOrderError" values={{ listingLink }} />
        </p>
      );
    }

    const speculateTransactionErrorMessage = speculateTransactionError ? (
      <p className={css.speculateError}>
        <FormattedMessage id="CheckoutPage.speculateTransactionError" />
      </p>
    ) : null;
    let speculateErrorMessage = null;

    if (isTransactionInitiateMissingStripeAccountError(speculateTransactionError)) {
      speculateErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.providerStripeAccountMissingError" />
        </p>
      );
    } else if (isTransactionInitiateBookingTimeNotAvailableError(speculateTransactionError)) {
      speculateErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.bookingTimeNotAvailableMessage" />
        </p>
      );
    } else if (isTransactionZeroPaymentError(speculateTransactionError)) {
      speculateErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.initiateOrderAmountTooLow" />
        </p>
      );
    } else if (speculateTransactionError) {
      speculateErrorMessage = (
        <p className={css.orderError}>
          <FormattedMessage id="CheckoutPage.speculateFailedMessage" />
        </p>
      );
    }

    const unitType = config.bookingUnitType;
    const isNightly = unitType === LINE_ITEM_NIGHT;
    const isDaily = unitType === LINE_ITEM_DAY;

    const unitTranslationKey = isNightly
      ? 'CheckoutPage.perNight'
      : isDaily
      ? 'CheckoutPage.perDay'
      : 'CheckoutPage.perUnit';

    const price = currentListing.attributes.price;
    const formattedPrice = formatMoney(intl, price);
    const detailsSubTitle = `${formattedPrice} ${intl.formatMessage({ id: unitTranslationKey })}`;

    const showInitialMessageInput = !(
      existingTransaction && existingTransaction.attributes.lastTransition === TRANSITION_ENQUIRE
    );

    // Get first and last name of the current user and use it in the StripePaymentForm to autofill the name field
    const userName =
      currentUser && currentUser.attributes
        ? `${currentUser.attributes.profile.firstName} ${currentUser.attributes.profile.lastName}`
        : null;

    // If paymentIntent status is not waiting user action,
    // confirmCardPayment has been called previously.
    const hasPaymentIntentUserActionsDone =
      paymentIntent && STRIPE_PI_USER_ACTIONS_DONE_STATUSES.includes(paymentIntent.status);

    // If your marketplace works mostly in one country you can use initial values to select country automatically
    // e.g. {country: 'FI'}

    const initalValuesForStripePayment = { name: userName };
    console.log(
      '🚀 | file: CheckoutPage.js | line 812 | CheckoutPageComponent | render | currentUser',
      currentUser
    );
    // const createRecurringParams = {
    //   weeklyAmount: price?.amount,
    //   listingId: currentListing?.id?.uuid,
    //   stripeCustomerId: currentUser?.stripeCustomer?.attributes?.stripeCustomerId,
    //   providerUserId: currentAuthor.id,
    //   paymentMethod:
    //     currentUser.stripeCustomer.defaultPaymentMethod.attributes.stripePaymentMethodId,
    //   transactionId: tx?.id?.uuid,
    // };
    return (
      <Page {...pageProps}>
        {topbar}
        <div className={css.contentContainer}>
          <div className={css.aspectWrapper}>
            <ResponsiveImage
              rootClassName={css.rootForImage}
              alt={listingTitle}
              image={firstImage}
              variants={['landscape-crop', 'landscape-crop2x']}
            />
          </div>
          <div className={classNames(css.avatarWrapper, css.avatarMobile)}>
            <AvatarMedium user={currentAuthor} disableProfileLink />
          </div>
          <div className={css.bookListingContainer}>
            <div className={css.heading}>
              <h1 className={css.title}>{title}</h1>
              <div className={css.author}>
                <FormattedMessage
                  id="CheckoutPage.hostedBy"
                  values={{ name: currentAuthor.attributes.profile.displayName }}
                />
              </div>
            </div>

            <div className={css.priceBreakdownContainer}>
              {speculateTransactionErrorMessage}
              {breakdown}
            </div>

            <section className={css.paymentContainer}>
              {initiateOrderErrorMessage}
              {listingNotFoundErrorMessage}
              {speculateErrorMessage}
              {retrievePaymentIntentError ? (
                <p className={css.orderError}>
                  <FormattedMessage
                    id="CheckoutPage.retrievingStripePaymentIntentFailed"
                    values={{ listingLink }}
                  />
                </p>
              ) : null}
              {/* <PrimaryButton
                inProgress={false}
                disabled={false}
                onClick={e => onCreateRecurring(createRecurringParams)}
              >
                TEST RECURRING
              </PrimaryButton> */}
              {showPaymentForm ? (
                <StripePaymentForm
                  className={css.paymentForm}
                  onSubmit={this.handleSubmit}
                  inProgress={this.state.submitting}
                  formId="CheckoutPagePaymentForm"
                  paymentInfo={intl.formatMessage({ id: 'CheckoutPage.paymentInfo' })}
                  authorDisplayName={currentAuthor.attributes.profile.displayName}
                  showInitialMessageInput={false}
                  initialValues={initalValuesForStripePayment}
                  initiateOrderError={initiateOrderError}
                  confirmCardPaymentError={confirmCardPaymentError}
                  confirmPaymentError={confirmPaymentError}
                  hasHandledCardPayment={hasPaymentIntentUserActionsDone}
                  loadingData={!stripeCustomerFetched}
                  defaultPaymentMethod={
                    hasDefaultPaymentMethod ? currentUser.stripeCustomer.defaultPaymentMethod : null
                  }
                  paymentIntent={paymentIntent}
                  onStripeInitialized={this.onStripeInitialized}
                />
              ) : null}
              {isPaymentExpired ? (
                <p className={css.orderError}>
                  <FormattedMessage
                    id="CheckoutPage.paymentExpiredMessage"
                    values={{ listingLink }}
                  />
                </p>
              ) : null}
            </section>
          </div>

          <div className={css.detailsContainerDesktop}>
            <div className={css.detailsAspectWrapper}>
              <ResponsiveImage
                rootClassName={css.rootForImage}
                alt={listingTitle}
                image={firstImage}
                variants={['landscape-crop', 'landscape-crop2x']}
              />
            </div>
            <div className={css.avatarWrapper}>
              <AvatarMedium user={currentAuthor} disableProfileLink />
            </div>
            <div className={css.detailsHeadings}>
              <h2 className={css.detailsTitle}>{listingTitle}</h2>
              <p className={css.detailsSubtitle}>{detailsSubTitle}</p>
            </div>
            {speculateTransactionErrorMessage}
            {breakdown}
          </div>
        </div>
      </Page>
    );
  }
}

CheckoutPageComponent.defaultProps = {
  initiateOrderError: null,
  confirmPaymentError: null,
  listing: null,
  bookingData: {},
  bookingDates: null,
  speculateTransactionError: null,
  speculatedTransaction: null,
  transaction: null,
  currentUser: null,
  paymentIntent: null,
};

CheckoutPageComponent.propTypes = {
  scrollingDisabled: bool.isRequired,
  listing: propTypes.listing,
  bookingData: object,
  bookingDates: shape({
    bookingStart: instanceOf(Date).isRequired,
    bookingEnd: instanceOf(Date).isRequired,
  }),
  fetchStripeCustomer: func.isRequired,
  stripeCustomerFetched: bool.isRequired,
  fetchSpeculatedTransaction: func.isRequired,
  speculateTransactionInProgress: bool.isRequired,
  speculateTransactionError: propTypes.error,
  speculatedTransaction: propTypes.transaction,
  transaction: propTypes.transaction,
  currentUser: propTypes.currentUser,
  params: shape({
    id: string,
    slug: string,
  }).isRequired,
  onConfirmPayment: func.isRequired,
  onInitiateOrder: func.isRequired,
  onConfirmCardPayment: func.isRequired,
  onRetrievePaymentIntent: func.isRequired,
  onSavePaymentMethod: func.isRequired,
  onSendMessage: func.isRequired,
  initiateOrderError: propTypes.error,
  confirmPaymentError: propTypes.error,
  // confirmCardPaymentError comes from Stripe so that's why we can't expect it to be in a specific form
  confirmCardPaymentError: oneOfType([propTypes.error, object]),
  paymentIntent: object,

  // from connect
  dispatch: func.isRequired,

  // from injectIntl
  intl: intlShape.isRequired,

  // from withRouter
  history: shape({
    push: func.isRequired,
  }).isRequired,
};

const mapStateToProps = state => {
  const {
    listing,
    bookingData,
    bookingDates,
    stripeCustomerFetched,
    speculateTransactionInProgress,
    speculateTransactionError,
    speculatedTransaction,
    transaction,
    initiateOrderError,
    confirmPaymentError,
  } = state.CheckoutPage;
  const { currentUser } = state.user;
  const { confirmCardPaymentError, paymentIntent, retrievePaymentIntentError } = state.stripe;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    stripeCustomerFetched,
    bookingData,
    bookingDates,
    speculateTransactionInProgress,
    speculateTransactionError,
    speculatedTransaction,
    transaction,
    listing,
    initiateOrderError,
    confirmCardPaymentError,
    confirmPaymentError,
    paymentIntent,
    retrievePaymentIntentError,
  };
};

const mapDispatchToProps = dispatch => ({
  dispatch,
  fetchSpeculatedTransaction: (params, transactionId) =>
    dispatch(speculateTransaction(params, transactionId)),
  fetchStripeCustomer: () => dispatch(stripeCustomer()),
  onInitiateOrder: (params, transactionId) => dispatch(initiateOrder(params, transactionId)),
  onRetrievePaymentIntent: params => dispatch(retrievePaymentIntent(params)),
  onConfirmCardPayment: params => dispatch(confirmCardPayment(params)),
  onConfirmPayment: params => dispatch(confirmPayment(params)),
  onSendMessage: params => dispatch(sendMessage(params)),
  onCreateRecurring: params => dispatch(createRecurring(params)),
  onSavePaymentMethod: (stripeCustomer, stripePaymentMethodId) =>
    dispatch(savePaymentMethod(stripeCustomer, stripePaymentMethodId)),
});

const CheckoutPage = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
  injectIntl
)(CheckoutPageComponent);

CheckoutPage.setInitialValues = (initialValues, saveToSessionStorage = false) => {
  console.log('🚀 | file: CheckoutPage.js | line 977 | saveToSessionStorage', saveToSessionStorage);
  console.log('🚀 | file: CheckoutPage.js | line 977 | initialValues', initialValues);

  if (saveToSessionStorage) {
    const { listing, bookingData, bookingDates } = initialValues;
    storeData(bookingData, bookingDates, listing, null, STORAGE_KEY);
  }

  return setInitialValues(initialValues);
};

CheckoutPage.displayName = 'CheckoutPage';

export default CheckoutPage;
