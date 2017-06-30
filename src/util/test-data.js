import Decimal from 'decimal.js';
import { types } from './sdkLoader';
import { nightsBetween } from '../util/dates';

const { UUID, LatLng, Money } = types;

// Create a booking that conforms to the util/propTypes booking schema
export const createBooking = (id, startDateInUTC, endDateInUTC) => ({
  id: new UUID(id),
  type: 'booking',
  attributes: {
    start: startDateInUTC,
    end: endDateInUTC,
  },
});

// Create a user that conforms to the util/propTypes user schema
export const createUser = id => ({
  id: new UUID(id),
  type: 'user',
  attributes: {
    profile: { firstName: `${id} first name`, lastName: `${id} last name` },
  },
});

// Create a user that conforms to the util/propTypes user schema
export const createCurrentUser = id => ({
  id: new UUID(id),
  type: 'user',
  attributes: {
    email: `${id}@example.com`,
    profile: { firstName: `${id} first name`, lastName: `${id} last name` },
    stripeConnected: true,
  },
});

// Create a user that conforms to the util/propTypes user schema
export const createImage = id => ({
  id: new UUID(id),
  type: 'image',
  attributes: {
    sizes: [
      {
        name: 'square',
        height: 408,
        width: 408,
        url: 'https://placehold.it/408x408',
      },
      {
        name: 'square2x',
        height: 816,
        width: 816,
        url: 'https://placehold.it/816x816',
      },
    ],
  },
});

// Create a user that conforms to the util/propTypes listing schema
export const createListing = (id, author = null, price = new Money(5500, 'USD')) => ({
  id: new UUID(id),
  type: 'listing',
  attributes: {
    title: `${id} title`,
    price,
    description: `${id} description`,
    address: `${id} address`,
    geolocation: new LatLng(40, 60),
  },
  author,
});

export const createTransaction = options => {
  const {
    id,
    state = 'state/preauthorized',
    total = new Money(1000, 'USD'),
    commission = new Money(100, 'USD'),
    booking = null,
    listing = null,
    customer = null,
    provider = null,
    lastTransitionedAt = new Date(Date.UTC(2017, 5, 1)),
  } = options;
  const nightCount = booking ? nightsBetween(booking.attributes.start, booking.attributes.end) : 1;
  return {
    id: new UUID(id),
    type: 'transaction',
    attributes: {
      createdAt: new Date(Date.UTC(2017, 4, 1)),
      lastTransitionedAt,
      state,
      payinTotal: total,
      payoutTotal: new Money(total.amount - commission.amount, total.currency),
      lineItems: [
        {
          code: 'line-item.purchase/night',
          quantity: new Decimal(nightCount),
          unitPrice: new Money(total.amount / nightCount, total.currency),
          lineTotal: total,
        },
        {
          code: 'line-item.commission/provider',
          unitPrice: commission,
          lineTotal: commission,
        },
      ],
    },
    booking,
    listing,
    customer,
    provider,
  };
};

// Default config for currency formatting in tests and examples.
export const currencyConfig = {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'symbol',
  useGrouping: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  subUnitDivisor: 100,
};

const pad = num => {
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

// Create fake Internalization object to help with shallow rendering.
export const fakeIntl = {
  formatDate: d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  formatHTMLMessage: d => d,
  formatMessage: msg => msg.id,
  formatNumber: d => d,
  formatPlural: d => d,
  formatRelative: d => d,
  formatTime: d => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  now: d => d,
};

const noop = () => null;

export const fakeFormProps = {
  anyTouched: false,
  asyncValidating: false,
  dirty: false,
  form: 'fakeTestForm',
  invalid: false,
  pristine: true,
  clearSubmit: noop,
  touch: noop,
  untouch: noop,
  submit: noop,
  reset: noop,
  initialize: noop,
  handleSubmit: noop,
  destroy: noop,
  clearAsyncError: noop,
  change: noop,
  blur: noop,
  autofill: noop,
  asyncValidate: noop,
  valid: true,
  submitSucceeded: false,
  submitFailed: false,
  submitting: false,
  pure: true,
  initialized: true,
};
