/**
 * Note: This form is using card from Stripe Elements https://stripe.com/docs/stripe-js#elements
 * Card is not a Final Form field so it's not available trough Final Form.
 * It's also handled separately in handleSubmit function.
 */
import React, { Component } from 'react';
import { bool, func, object, string } from 'prop-types';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';
import config from '../../config';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { ensurePaymentMethodCard } from '../../util/data';

import {
  Form,
  PrimaryButton,
  FieldCheckbox,
  FieldTextInput,
  IconSpinner,
  SavedCardDetails,
  StripePaymentAddress,
} from '../../components';
import css from './StripePaymentForm.module.css';

/**
 * Translate a Stripe API error object.
 *
 * To keep up with possible keys from the Stripe API, see:
 *
 * https://stripe.com/docs/api#errors
 *
 * Note that at least at moment, the above link doesn't list all the
 * error codes that the API returns.
 *
 * @param {Object} intl - react-intl object from injectIntl
 * @param {Object} stripeError - error object from Stripe API
 *
 * @return {String} translation message for the specific Stripe error,
 * or the given error message (not translated) if the specific error
 * type/code is not defined in the translations
 *
 */
const stripeErrorTranslation = (intl, stripeError) => {
  const { message, code, type } = stripeError;

  if (!code || !type) {
    // Not a proper Stripe error object
    return intl.formatMessage({ id: 'StripePaymentFormPlatformFee.genericError' });
  }

  const translationId =
    type === 'validation_error'
      ? `StripePaymentFormPlatformFee.stripe.validation_error.${code}`
      : `StripePaymentFormPlatformFee.stripe.${type}`;

  return intl.formatMessage({
    id: translationId,
    defaultMessage: message,
  });
};

const stripeElementsOptions = {
  fonts: [
    {
      family: 'Montserrat',
      fontSmoothing: 'antialiased',
    },
  ],
};

// card (being a Stripe Elements component), can have own styling passed to it.
// However, its internal width-calculation seems to break if font-size is too big
// compared to component's own width.
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const cardStyles = {
  base: {
    fontFamily: '"Montserrat", Helvetica, Arial, sans-serif',
    fontSize: isMobile ? '14px' : '18px',
    fontSmoothing: 'antialiased',
    lineHeight: '24px',
    letterSpacing: '-0.1px',
    color: '#4A4A4A',
    '::placeholder': {
      color: '#B2B2B2',
    },
  },
};

const OneTimePaymentWithCardElement = props => {
  const { cardClasses, formId, handleStripeElementRef, hasCardError, error, label, intl } = props;
  const labelText =
    label || intl.formatMessage({ id: 'StripePaymentFormPlatformFee.saveAfterOnetimePayment' });
  return (
    <React.Fragment>
      <label className={css.paymentLabel} htmlFor={`${formId}-card`}>
        <FormattedMessage id="StripePaymentFormPlatformFee.paymentCardDetails" />
      </label>
      <div className={cardClasses} id={`${formId}-card`} ref={handleStripeElementRef} />
      {hasCardError ? <span className={css.error}>{error}</span> : null}
      <div className={css.saveForLaterUse}>
        <FieldCheckbox
          className={css.saveForLaterUseCheckbox}
          textClassName={css.saveForLaterUseLabel}
          id="saveAfterOnetimePayment"
          name="saveAfterOnetimePayment"
          label={labelText}
          value="saveAfterOnetimePayment"
          useSuccessColor
        />
        <span className={css.saveForLaterUseLegalInfo}>
          <FormattedMessage id="StripePaymentFormPlatformFee.saveforLaterUseLegalInfo" />
        </span>
      </div>
    </React.Fragment>
  );
};

const PaymentMethodSelector = props => {
  const {
    cardClasses,
    formId,
    changePaymentMethod,
    defaultPaymentMethod,
    handleStripeElementRef,
    hasCardError,
    error,
    paymentMethod,
    intl,
  } = props;
  const last4Digits = defaultPaymentMethod.attributes.card.last4Digits;
  const labelText = intl.formatMessage(
    { id: 'StripePaymentFormPlatformFee.replaceAfterOnetimePayment' },
    { last4Digits }
  );

  return (
    <React.Fragment>
      <h3 className={css.paymentHeading}>
        <FormattedMessage id="StripePaymentFormPlatformFee.payWithHeading" />
      </h3>
      <SavedCardDetails
        className={css.paymentMethodSelector}
        card={defaultPaymentMethod.attributes.card}
        onChange={changePaymentMethod}
      />
      {paymentMethod === 'replaceCard' ? (
        <OneTimePaymentWithCardElement
          cardClasses={cardClasses}
          formId={formId}
          handleStripeElementRef={handleStripeElementRef}
          hasCardError={hasCardError}
          error={error}
          label={labelText}
          intl={intl}
        />
      ) : null}
    </React.Fragment>
  );
};

const getPaymentMethod = (selectedPaymentMethod, hasDefaultPaymentMethod) => {
  return selectedPaymentMethod == null && hasDefaultPaymentMethod
    ? 'defaultCard'
    : selectedPaymentMethod == null
    ? 'onetimeCardPayment'
    : selectedPaymentMethod;
};

const initialState = {
  error: null,
  cardValueValid: false,
  // The mode can be 'onetimePayment', 'defaultCard', or 'replaceCard'
  // Check SavedCardDetails component for more information
  paymentMethod: null,
};

/**
 * Payment form that asks for credit card info using Stripe Elements.
 *
 * When the card is valid and the user submits the form, a request is
 * sent to the Stripe API to handle payment. `stripe.confirmCardPayment`
 * may ask more details from cardholder if 3D security steps are needed.
 *
 * See: https://stripe.com/docs/payments/payment-intents
 *      https://stripe.com/docs/elements
 */
class StripePaymentFormPlatformFee extends Component {
  constructor(props) {
    super(props);
    this.state = initialState;
    this.handleCardValueChange = this.handleCardValueChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.paymentForm = this.paymentForm.bind(this);
    this.initializeStripeElement = this.initializeStripeElement.bind(this);
    this.handleStripeElementRef = this.handleStripeElementRef.bind(this);
    this.changePaymentMethod = this.changePaymentMethod.bind(this);
    this.finalFormAPI = null;
    this.cardContainer = null;
  }

  componentDidMount() {
    if (!window.Stripe) {
      throw new Error('Stripe must be loaded for StripePaymentFormPlatformFee');
    }

    if (config.stripe.publishableKey) {
      const {
        onStripeInitialized,
        hasHandledCardPayment,
        defaultPaymentMethod,
        loadingData,
      } = this.props;
      this.stripe = window.Stripe(config.stripe.publishableKey);
      onStripeInitialized(this.stripe);

      if (!(hasHandledCardPayment || defaultPaymentMethod || loadingData)) {
        this.initializeStripeElement();
      }
    }
  }

  componentWillUnmount() {
    if (this.card) {
      this.card.removeEventListener('change', this.handleCardValueChange);
      this.card.unmount();
      this.card = null;
    }
  }

  initializeStripeElement(element) {
    const elements = this.stripe.elements(stripeElementsOptions);

    if (!this.card) {
      this.card = elements.create('card', { style: cardStyles });
      this.card.mount(element || this.cardContainer);
      this.card.addEventListener('change', this.handleCardValueChange);
      // EventListener is the only way to simulate breakpoints with Stripe.
      window.addEventListener('resize', () => {
        if (this.card) {
          if (window.innerWidth < 768) {
            this.card.update({ style: { base: { fontSize: '14px', lineHeight: '24px' } } });
          } else {
            this.card.update({ style: { base: { fontSize: '18px', lineHeight: '24px' } } });
          }
        }
      });
    }
  }

  changePaymentMethod(changedTo) {
    if (this.card && changedTo === 'defaultCard') {
      this.card.removeEventListener('change', this.handleCardValueChange);
      this.card.unmount();
      this.card = null;
    }
    this.setState({ paymentMethod: changedTo });
  }

  handleStripeElementRef(el) {
    this.cardContainer = el;
    if (this.stripe && el) {
      this.initializeStripeElement(el);
    }
  }

  handleCardValueChange(event) {
    const { intl } = this.props;
    const { error, complete } = event;

    const postalCode = event.value.postalCode;
    if (this.finalFormAPI) {
      this.finalFormAPI.change('postal', postalCode);
    }

    this.setState(() => {
      return {
        error: error ? stripeErrorTranslation(intl, error) : null,
        cardValueValid: complete,
      };
    });
  }
  handleSubmit(values) {
    const {
      onSubmit,
      inProgress,
      formId,
      hasHandledCardPayment,
      defaultPaymentMethod,
    } = this.props;
    const { initialMessage } = values;
    const { cardValueValid, paymentMethod } = this.state;
    const billingDetailsKnown = hasHandledCardPayment || defaultPaymentMethod;
    const onetimePaymentNeedsAttention = !billingDetailsKnown && !cardValueValid;

    if (inProgress || onetimePaymentNeedsAttention) {
      // Already submitting or card value incomplete/invalid
      return;
    }

    const params = {
      message: initialMessage ? initialMessage.trim() : null,
      card: this.card,
      formId,
      formValues: values,
      paymentMethod: getPaymentMethod(
        paymentMethod,
        ensurePaymentMethodCard(defaultPaymentMethod).id
      ),
    };
    onSubmit(params);
  }

  paymentForm(formRenderProps) {
    const {
      className,
      rootClassName,
      inProgress: submitInProgress,
      loadingData,
      formId,
      paymentInfo,
      authorDisplayName,
      showInitialMessageInput,
      intl,
      initiateOrderError,
      confirmCardPaymentError,
      confirmPaymentError,
      invalid,
      handleSubmit,
      form,
      hasHandledCardPayment,
      defaultPaymentMethod,
      disabled,
      validCouponCode,
    } = formRenderProps;

    this.finalFormAPI = form;

    const ensuredDefaultPaymentMethod = ensurePaymentMethodCard(defaultPaymentMethod);
    const billingDetailsNeeded = !(hasHandledCardPayment || confirmPaymentError);
    const billingDetailsKnown = hasHandledCardPayment || ensuredDefaultPaymentMethod;
    const onetimePaymentNeedsAttention = !billingDetailsKnown && !this.state.cardValueValid;
    const submitDisabled = validCouponCode
      ? submitInProgress
      : disabled || invalid || onetimePaymentNeedsAttention || submitInProgress;
    const hasCardError = this.state.error && !submitInProgress;
    const hasPaymentErrors = confirmCardPaymentError || confirmPaymentError;
    const classes = classNames(rootClassName || css.root, className);
    const cardClasses = classNames(css.card, {
      [css.cardSuccess]: this.state.cardValueValid,
      [css.cardError]: hasCardError,
    });

    // TODO: confirmCardPayment can create all kinds of errors.
    // Currently, we provide translation support for one:
    // https://stripe.com/docs/error-codes
    const piAuthenticationFailure = 'payment_intent_authentication_failure';
    const paymentErrorMessage =
      confirmCardPaymentError && confirmCardPaymentError.code === piAuthenticationFailure
        ? intl.formatMessage({ id: 'StripePaymentFormPlatformFee.confirmCardPaymentError' })
        : confirmCardPaymentError
        ? confirmCardPaymentError.message
        : confirmPaymentError
        ? intl.formatMessage({ id: 'StripePaymentFormPlatformFee.confirmPaymentError' })
        : intl.formatMessage({ id: 'StripePaymentFormPlatformFee.genericError' });

    const billingDetailsNameLabel = intl.formatMessage({
      id: 'StripePaymentFormPlatformFee.billingDetailsNameLabel',
    });

    const billingDetailsNamePlaceholder = intl.formatMessage({
      id: 'StripePaymentFormPlatformFee.billingDetailsNamePlaceholder',
    });

    const messagePlaceholder = intl.formatMessage(
      { id: 'StripePaymentFormPlatformFee.messagePlaceholder' },
      { name: authorDisplayName }
    );

    const messageOptionalText = intl.formatMessage({
      id: 'StripePaymentFormPlatformFee.messageOptionalText',
    });

    const initialMessageLabel = intl.formatMessage(
      { id: 'StripePaymentFormPlatformFee.messageLabel' },
      { messageOptionalText: messageOptionalText }
    );

    // Asking billing address is recommended in PaymentIntent flow.
    // In CheckoutPage, we send name and email as billing details, but address only if it exists.
    const billingAddress = (
      <StripePaymentAddress intl={intl} form={form} fieldId={formId} card={this.card} />
    );

    const hasStripeKey = config.stripe.publishableKey;
    const showPaymentMethodSelector = ensuredDefaultPaymentMethod.id;
    const selectedPaymentMethod = getPaymentMethod(
      this.state.paymentMethod,
      showPaymentMethodSelector
    );
    const showOnetimePaymentFields = ['onetimeCardPayment', 'replaceCard'].includes(
      selectedPaymentMethod
    );
    return hasStripeKey ? (
      <Form className={classes} onSubmit={handleSubmit} enforcePagePreloadFor="OrderDetailsPage">
        {billingDetailsNeeded && !loadingData ? (
          <React.Fragment>
            {showPaymentMethodSelector ? (
              <PaymentMethodSelector
                cardClasses={cardClasses}
                formId={formId}
                defaultPaymentMethod={ensuredDefaultPaymentMethod}
                changePaymentMethod={this.changePaymentMethod}
                handleStripeElementRef={this.handleStripeElementRef}
                hasCardError={hasCardError}
                error={this.state.error}
                paymentMethod={selectedPaymentMethod}
                intl={intl}
              />
            ) : (
              <React.Fragment>
                <h3 className={css.paymentHeading}>
                  <FormattedMessage id="StripePaymentFormPlatformFee.paymentHeading" />
                </h3>
                <OneTimePaymentWithCardElement
                  cardClasses={cardClasses}
                  formId={formId}
                  handleStripeElementRef={this.handleStripeElementRef}
                  hasCardError={hasCardError}
                  error={this.state.error}
                  intl={intl}
                />
              </React.Fragment>
            )}

            {showOnetimePaymentFields ? (
              <div className={css.paymentAddressField}>
                <h3 className={css.billingHeading}>
                  <FormattedMessage id="StripePaymentFormPlatformFee.billingDetails" />
                </h3>

                <FieldTextInput
                  className={css.field}
                  type="text"
                  id="name"
                  name="name"
                  autoComplete="cc-name"
                  label={billingDetailsNameLabel}
                  placeholder={billingDetailsNamePlaceholder}
                />

                {/* {billingAddress} */}
              </div>
            ) : null}
          </React.Fragment>
        ) : loadingData ? (
          <p className={css.spinner}>
            <IconSpinner />
          </p>
        ) : null}

        {initiateOrderError ? (
          <span className={css.errorMessage}>{initiateOrderError.message}</span>
        ) : null}
        {showInitialMessageInput ? (
          <div>
            <h3 className={css.messageHeading}>
              <FormattedMessage id="StripePaymentFormPlatformFee.messageHeading" />
            </h3>

            <FieldTextInput
              type="textarea"
              id={`${formId}-initialMessage`}
              name="initialMessage"
              label={initialMessageLabel}
              placeholder={messagePlaceholder}
              className={css.message}
            />
          </div>
        ) : null}
        <div className={css.submitContainer}>
          {hasPaymentErrors ? (
            <span className={css.errorMessage}>{paymentErrorMessage}</span>
          ) : null}
          <p className={css.paymentInfo}>{paymentInfo}</p>
          <PrimaryButton
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
          >
            {billingDetailsNeeded ? (
              <FormattedMessage id="StripePaymentFormPlatformFee.submitPaymentInfo" />
            ) : (
              <FormattedMessage id="StripePaymentFormPlatformFee.submitConfirmPaymentInfo" />
            )}
          </PrimaryButton>
        </div>
      </Form>
    ) : (
      <div className={css.missingStripeKey}>
        <FormattedMessage id="StripePaymentFormPlatformFee.missingStripeKey" />
      </div>
    );
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const { onSubmit, ...rest } = this.props;
    return <FinalForm onSubmit={this.handleSubmit} {...rest} render={this.paymentForm} />;
  }
}

StripePaymentFormPlatformFee.defaultProps = {
  className: null,
  rootClassName: null,
  inProgress: false,
  loadingData: false,
  showInitialMessageInput: true,
  hasHandledCardPayment: false,
  defaultPaymentMethod: null,
  initiateOrderError: null,
  confirmCardPaymentError: null,
  confirmPaymentError: null,
};

StripePaymentFormPlatformFee.propTypes = {
  className: string,
  rootClassName: string,
  inProgress: bool,
  loadingData: bool,
  initiateOrderError: object,
  confirmCardPaymentError: object,
  confirmPaymentError: object,
  formId: string.isRequired,
  intl: intlShape.isRequired,
  onSubmit: func.isRequired,
  paymentInfo: string.isRequired,
  authorDisplayName: string.isRequired,
  showInitialMessageInput: bool,
  hasHandledCardPayment: bool,
  defaultPaymentMethod: propTypes.defaultPaymentMethod,
};

export default injectIntl(StripePaymentFormPlatformFee);
