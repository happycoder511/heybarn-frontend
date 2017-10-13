import React, { Component, PropTypes } from 'react'; // eslint-disable-line react/no-deprecated
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import classNames from 'classnames';
import { Form, PrimaryButton } from '../../components';
import * as log from '../../util/log';
import config from '../../config';

import css from './StripePaymentForm.css';

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
    return intl.formatMessage({ id: 'StripePaymentForm.genericError' });
  }

  const translationId =
    type === 'validation_error'
      ? `StripePaymentForm.stripe.validation_error.${code}`
      : `StripePaymentForm.stripe.${type}`;

  return intl.formatMessage({
    id: translationId,
    defaultMessage: message,
  });
};

const stripeElementsOptions = {
  fonts: [
    {
      family: 'sofiapro',
      fontSmoothing: 'antialiased',
      src:
        'local("sofiapro"), local("SofiaPro"), local("Sofia Pro"), url("https://assets-sharetribecom.sharetribe.com/webfonts/sofiapro/sofiapro-medium-webfont.woff2") format("woff2")',
    },
  ],
};

const cardStyles = {
  base: {
    fontFamily: '"sofiapro", Helvetica, Arial, sans-serif',
    fontSize: '18px',
    fontSmoothing: 'antialiased',
    lineHeight: '24px',
    letterSpacing: '-0.1px',
    color: '#4A4A4A',
    '::placeholder': {
      color: '#B2B2B2',
    },
  },
};

/**
 * Payment form that asks for credit card info using Stripe Elements.
 *
 * When the card is valid and the user submits the form, a request is
 * sent to the Stripe API to fetch a token that is passed to the
 * onSubmit prop of this form.
 *
 * See: https://stripe.com/docs/elements
 */
class StripePaymentForm extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, submitting: false, cardValueValid: false };
    this.handleCardValueChange = this.handleCardValueChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }
  componentDidMount() {
    if (!window.Stripe) {
      throw new Error('Stripe must be loaded for StripePaymentForm');
    }
    this.stripe = window.Stripe(config.stripe.publishableKey);
    const elements = this.stripe.elements(stripeElementsOptions);
    this.card = elements.create('card', { style: cardStyles });
    this.card.mount(this.cardContainer);
    this.card.addEventListener('change', this.handleCardValueChange);

    // EventListener is the only way to simulate breakpoints with Stripe.
    window.addEventListener('resize', () => {
      if (window.innerWidth < 1024) {
        this.card.update({ style: { base: { fontSize: '18px', lineHeight: '24px' } } });
      } else {
        this.card.update({ style: { base: { fontSize: '20px', lineHeight: '32px' } } });
      }
    });
  }
  componentWillUnmount() {
    if (this.card) {
      this.card.removeEventListener('change', this.handleCardValueChange);
      this.card.unmount();
    }
  }
  handleCardValueChange(event) {
    const { intl } = this.props;
    const { error, complete } = event;
    this.setState({
      error: error ? stripeErrorTranslation(intl, error) : null,
      cardValueValid: complete,
    });
  }
  handleSubmit(event) {
    event.preventDefault();

    if (this.state.submitting || !this.state.cardValueValid) {
      // Already submitting or card value incomplete/invalid
      return;
    }

    const { intl, onSubmit } = this.props;
    this.setState({ submitting: true });

    this.stripe
      .createToken(this.card)
      .then(result => {
        const { error, token } = result;
        if (error) {
          this.setState({
            submitting: false,
            error: stripeErrorTranslation(intl, error),
          });
        } else {
          this.setState({ submitting: false });
          onSubmit(token.id);
        }
      })
      .catch(e => {
        log.error(e, 'stripe-payment-form-submit-failed', {
          stripeErrorType: e.type,
          stripeErrorCode: e.code,
        });

        this.setState({
          submitting: false,
          error: stripeErrorTranslation(intl, e),
        });
      });
  }
  render() {
    const { className, rootClassName, inProgress, formId, paymentInfo } = this.props;
    const submitInProgress = this.state.submitting || inProgress;
    const submitDisabled = !this.state.cardValueValid || submitInProgress;
    const classes = classNames(rootClassName || css.root, className);
    const cardClasses = classNames(css.card, {
      [css.cardSuccess]: this.state.cardValueValid,
      [css.cardError]: this.state.error,
    });

    return (
      <Form className={classes} onSubmit={this.handleSubmit}>
        <label className={css.label} htmlFor={`${formId}-card`}>
          <FormattedMessage id="StripePaymentForm.creditCardDetails" />
        </label>
        <div
          className={cardClasses}
          id={`${formId}-card`}
          ref={el => {
            this.cardContainer = el;
          }}
        />
        {this.state.error ? <span style={{ color: 'red' }}>{this.state.error}</span> : null}
        <div className={css.submitContainer}>
          {paymentInfo ? <p className={css.paymentInfo}>{paymentInfo}</p> : null}
          <PrimaryButton
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
          >
            <FormattedMessage id="StripePaymentForm.submitPaymentInfo" />
          </PrimaryButton>
        </div>
      </Form>
    );
  }
}

StripePaymentForm.defaultProps = {
  className: null,
  rootClassName: null,
  inProgress: false,
  paymentInfo: null,
};

const { bool, func, string } = PropTypes;

StripePaymentForm.propTypes = {
  className: string,
  rootClassName: string,
  inProgress: bool,
  formId: string.isRequired,
  intl: intlShape.isRequired,
  onSubmit: func.isRequired,
  paymentInfo: string,
};

export default injectIntl(StripePaymentForm);
