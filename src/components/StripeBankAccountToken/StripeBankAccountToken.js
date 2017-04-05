/* eslint-disable no-underscore-dangle */
import React, { Component, PropTypes } from 'react';
import { intlShape, injectIntl, FormattedMessage } from 'react-intl';
import { debounce } from 'lodash';
import { Input } from '../../components';
import config from '../../config';

import css from './StripeBankAccountToken.css';

const DEBOUNCE_WAIT_TIME = 200;

const ErrorMessage = props => <span style={{ color: 'red' }}>{props.children}</span>;
ErrorMessage.propTypes = { children: PropTypes.any.isRequired };

/**
 * Create a single-use token from the given bank account data
 *
 * See: https://stripe.com/docs/stripe.js#collecting-bank-account-details
 *
 * @param {Object} data - bank account data sent to Stripe
 *
 * @return {Promise<String>} Promise that resolves with the bank
 * account token or rejects when the token creation fails
 */
const createToken = data =>
  new Promise((resolve, reject) => {
    window.Stripe.bankAccount.createToken(data, (status, response) => {
      if (response.error) {
        const e = new Error(response.error.message);
        e.response = response;
        reject(e);
      } else {
        resolve(response.id);
      }
    });
  });

// In addition to the bank account number, Stripe requires a routing
// number when the currency is not EUR. When it is EUR, the account
// number is expected to be an IBAN number.
//
// See: https://stripe.com/docs/stripe.js#bank-account-createToken
const requiresRoutingNumber = currency => currency !== 'EUR';

const isRoutingNumberValid = (routingNumber, country) =>
  window.Stripe.bankAccount.validateRoutingNumber(routingNumber, country);

const isBankAccountNumberValid = (accountNumber, country) =>
  window.Stripe.bankAccount.validateAccountNumber(accountNumber, country);

const initialState = { accountNumber: '', routingNumber: '', error: null };

class StripeBankAccountToken extends Component {
  constructor(props) {
    super(props);

    // We keep track of the mounted state of the component to avoid
    // setting state or calling callback props if a createToken call
    // finishes after the component is already removed.
    //
    // The correct solution would be to cancel all ongoing operations
    // in componentWillUnmount, but since Promises don't have a
    // cancellation mechanism yet, we must use a different solution
    // for now.
    //
    // See: https://facebook.github.io/react/blog/2015/12/16/ismounted-antipattern.html
    this._isMounted = false;

    this.state = initialState;
    this.requestToken = debounce(this.requestToken.bind(this), DEBOUNCE_WAIT_TIME);
  }
  componentDidMount() {
    if (!window.Stripe) {
      throw new Error('Stripe must be loaded for StripeBankAccountToken');
    }
    this._isMounted = true;
  }
  componentWillReceiveProps(nextProps) {
    const countryChanged = nextProps.country !== this.props.country;
    const currencyChanged = nextProps.currency !== this.props.currency;
    if (countryChanged || currencyChanged) {
      // Clear the possible routing and bank account numbers from the
      // state if the given country or currency changes.
      this.setState(initialState);
      nextProps.input.onChange('');
    }
  }
  componentWillUnmount() {
    this._isMounted = false;
  }

  /**
   * Request a token from the Stripe API with the given bank account data
   *
   * This function validates the given data and triggers onChange
   * events for the parent form to handle.
   *
   *
   * @param {String} accountNumber - bank account number
   * @param {String} routingNumber - routing number for non-IBAN bank accounts
   */
  requestToken(accountNumber, routingNumber) {
    const { country, currency, input: { onChange }, intl } = this.props;
    const routingNumRequired = requiresRoutingNumber(currency);

    const invalidRoutingNumberMessage = intl.formatMessage(
      {
        id: 'StripeBankAccountToken.invalidRoutingNumber',
      },
      {
        number: routingNumber,
        country,
      }
    );

    const stripeCreateBankAccountTokenErrorMessage = intl.formatMessage(
      {
        id: routingNumRequired
          ? 'StripeBankAccountToken.createBankAccountTokenError'
          : 'StripeBankAccountToken.createBankAccountTokenErrorIban',
      },
      { country, currency }
    );

    // First we have to clear the current token value so the parent
    // form doesn't submit with an old value.
    onChange('');

    if (!accountNumber || (routingNumRequired && !routingNumber)) {
      // Incomplete info, not requesting token
      return;
    }

    if (routingNumRequired && !isRoutingNumberValid(routingNumber, country)) {
      this.setState({ error: new Error(invalidRoutingNumberMessage) });
      return;
    }

    if (!isBankAccountNumberValid(accountNumber, country)) {
      // Bank account number invalid, the user might not be finished typing it
      return;
    }

    const accountData = {
      country: this.props.country,
      currency: this.props.currency,
      account_number: accountNumber,
    };
    if (routingNumRequired) {
      accountData.routing_number = routingNumber;
    }
    createToken(accountData)
      .then(token => {
        if (this._isMounted && accountNumber === this.state.accountNumber) {
          // Handle response only if the current number hasn't changed
          this.setState({ error: null });
          onChange(token);
        }
      })
      .catch(e => {
        // eslint-disable-next-line no-console
        console.error(e);
        if (this._isMounted) {
          this.setState({ error: new Error(stripeCreateBankAccountTokenErrorMessage) });
        }
      });
  }
  render() {
    const { country, currency, input, meta, intl } = this.props;
    const { value: tokenValue, onBlur } = input;
    const { touched, error: formError } = meta;

    if (!config.stripe.supportedCountries.includes(country)) {
      return (
        <ErrorMessage>
          <FormattedMessage id="StripeBankAccountToken.unsupportedCountry" values={{ country }} />
        </ErrorMessage>
      );
    }

    // We must inform redux-form of the blur to each field for it to
    // change the meta.touched prop correctly.
    const handleBlur = () => {
      onBlur(tokenValue);
    };

    const handleAccountNumberChange = e => {
      const value = e.target.value.trim();
      this.setState({ accountNumber: value, error: null });
      this.requestToken(value, this.state.routingNumber);
    };

    const handleRoutingNumberChange = e => {
      const value = e.target.value.trim();
      this.setState({ routingNumber: value });
      this.requestToken(this.state.accountNumber, value);
    };

    const routingNumRequired = requiresRoutingNumber(currency);
    const routingNumberPlaceholder = intl.formatMessage({
      id: 'StripeBankAccountToken.routingNumberPlaceholder',
    });
    const accountNumberPlaceholder = intl.formatMessage({
      id: 'StripeBankAccountToken.accountNumberPlaceholder',
    });

    const routingNumberInput = (
      <Input
        inline={routingNumRequired}
        className={css.routingNumber}
        name="routingNumber"
        value={this.state.routingNumber}
        placeholder={routingNumberPlaceholder}
        onChange={handleRoutingNumberChange}
        onBlur={handleBlur}
      />
    );

    const showErrors = touched;

    return (
      <div>
        <label htmlFor={input.name}>
          {routingNumRequired
            ? <FormattedMessage id="StripeBankAccountToken.bankAccountNumberLabel" />
            : <FormattedMessage id="StripeBankAccountToken.bankAccountNumberLabelIban" />}
        </label>
        {routingNumRequired ? routingNumberInput : null}
        <Input
          inline={routingNumRequired}
          className={routingNumRequired ? css.accountNumberNotIban : null}
          value={this.state.accountNumber}
          placeholder={accountNumberPlaceholder}
          onChange={handleAccountNumberChange}
          onBlur={handleBlur}
        />
        {showErrors && this.state.error
          ? <ErrorMessage>{this.state.error.message}</ErrorMessage>
          : null}
        {showErrors && formError && !this.state.error
          ? <ErrorMessage>{formError}</ErrorMessage>
          : null}
      </div>
    );
  }
}

const { string, shape, func, bool } = PropTypes;

StripeBankAccountToken.propTypes = {
  country: string.isRequired,
  currency: string.isRequired,
  input: shape({
    name: string.isRequired,
    onChange: func.isRequired,
    onBlur: func.isRequired,
  }).isRequired,
  meta: shape({
    touched: bool.isRequired,
    error: string,
  }).isRequired,
  intl: intlShape.isRequired,
};

export default injectIntl(StripeBankAccountToken);
