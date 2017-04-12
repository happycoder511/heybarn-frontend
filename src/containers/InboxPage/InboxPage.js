import React, { PropTypes } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import { PageLayout, NamedRedirect, NamedLink, H1 } from '../../components';
import * as propTypes from '../../util/propTypes';
import { getEntities } from '../../ducks/sdk.duck';
import { loadData } from './InboxPage.duck';

import css from './InboxPage.css';

const { shape, string, arrayOf, bool, oneOf } = PropTypes;

// Formatted username
const username = user => {
  const profile = user && user.attributes && user.attributes.profile
    ? user.attributes.profile
    : null;
  return profile ? `${profile.firstName} ${profile.lastName}` : '';
};

// Localised timestamp when the given transaction was updated
const timestamp = (intl, tx) => {
  const date = tx.attributes ? tx.attributes.lastTransitionedAt : null;
  return date ? intl.formatDate(date) : '';
};

// Translated name of the state of the given transaction
const txState = (intl, tx) => {
  const { state } = tx;
  if (state === propTypes.TX_STATE_ACCEPTED) {
    return intl.formatMessage({
      id: 'InboxPage.stateAccepted',
    });
  } else if (state === propTypes.TX_STATE_REJECTED) {
    return intl.formatMessage({
      id: 'InboxPage.stateRejected',
    });
  }
  return intl.formatMessage({
    id: 'InboxPage.statePending',
  });
};

const InboxItem = props => {
  const { type, tx, intl } = props;
  const { customer, provider } = tx;
  const isOrder = type === 'order';
  const otherUserName = username(isOrder ? provider : customer);
  const otherUserAvatar = 'https://placehold.it/44x44';
  return (
    <NamedLink
      className={css.itemLink}
      name={isOrder ? 'OrderDetailsPage' : 'SaleDetailsPage'}
      params={{ id: tx.id.uuid }}
    >
      <div className={css.itemAvatar}>
        <img className={css.itemAvatarImage} src={otherUserAvatar} alt={otherUserName} />
      </div>
      <div className={css.itemInfo}>
        <div>
          <span className={css.itemUsername}>{otherUserName}</span>
          <span className={css.itemTimestamp}>{timestamp(intl, tx)}</span>
        </div>
        <div className={css.itemState}>{txState(intl, tx)}</div>
      </div>
    </NamedLink>
  );
};

InboxItem.propTypes = {
  type: oneOf(['order', 'sale']).isRequired,
  tx: propTypes.transaction.isRequired,
  intl: intlShape.isRequired,
};

export const InboxPageComponent = props => {
  const { fetchInProgress, transactions, intl, params } = props;
  const { tab } = params;

  const validTab = tab === 'orders' || tab === 'sales';
  if (!validTab) {
    return <NamedRedirect name="NotFoundPage" />;
  }

  const isOrders = tab === 'orders';

  const ordersTitle = intl.formatMessage({ id: 'InboxPage.ordersTitle' });
  const salesTitle = intl.formatMessage({ id: 'InboxPage.salesTitle' });
  const title = isOrders ? ordersTitle : salesTitle;

  const toTxItem = tx => {
    return (
      <li key={tx.id.uuid} className={css.listItem}>
        <InboxItem type={isOrders ? 'order' : 'sale'} tx={tx} intl={intl} />
      </li>
    );
  };

  return (
    <PageLayout title={title}>
      <H1 className={css.title}>
        <FormattedMessage id="InboxPage.title" />
      </H1>
      <nav>
        <NamedLink
          className={css.tab}
          name="InboxPage"
          params={{ tab: 'orders' }}
          activeClassName={tab === 'orders' ? css.activeTab : null}
        >
          <FormattedMessage id="InboxPage.ordersTabTitle" />
        </NamedLink>
        <NamedLink
          className={css.tab}
          name="InboxPage"
          params={{ tab: 'sales' }}
          activeClassName={tab === 'sales' ? css.activeTab : null}
        >
          <FormattedMessage id="InboxPage.salesTabTitle" />
        </NamedLink>
      </nav>
      <ul>
        {!fetchInProgress ? transactions.map(toTxItem) : null}
      </ul>
    </PageLayout>
  );
};

InboxPageComponent.propTypes = {
  params: shape({
    tab: string.isRequired,
  }).isRequired,

  fetchInProgress: bool.isRequired,
  transactions: arrayOf(propTypes.transaction).isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const mapStateToProps = state => {
  const marketplaceData = state.data;
  const refs = state.InboxPage.transactionRefs;
  return {
    fetchInProgress: state.InboxPage.fetchInProgress,
    transactions: getEntities(marketplaceData, refs),
  };
};

const InboxPage = compose(connect(mapStateToProps), injectIntl)(InboxPageComponent);

InboxPage.loadData = loadData;

export default InboxPage;
