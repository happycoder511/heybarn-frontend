import React, { PropTypes } from 'react';
import classNames from 'classnames';
import { FormattedMessage, intlShape, injectIntl } from 'react-intl';
import { compose } from 'redux';
import { connect } from 'react-redux';
import * as propTypes from '../../util/propTypes';
import { ensureBooking, ensureListing, ensureTransaction, ensureUser } from '../../util/data';
import { Button, NamedRedirect, SaleDetailsPanel, PageLayout } from '../../components';
import { getEntities } from '../../ducks/marketplaceData.duck';
import { acceptSale, rejectSale, loadData } from './SalePage.duck';

import css from './SalePage.css';

// SalePage handles data loading
// It show loading data text or SaleDetailsPanel (and later also another panel for messages).
export const SalePageComponent = props => {
  const { currentUser, intl, onAcceptSale, onRejectSale, transaction } = props;
  const currentTransaction = ensureTransaction(transaction);
  const currentListing = ensureListing(currentTransaction.listing);
  const title = currentListing.attributes.title;

  // Redirect users with someone else's direct link to their own inbox/sales page.
  const isDataAvailable = currentUser && currentTransaction.id && currentTransaction.provider;
  const isOwnSale = isDataAvailable && currentUser.id.uuid === currentTransaction.provider.id.uuid;
  if (isDataAvailable && !isOwnSale) {
    // eslint-disable-next-line no-console
    console.error('Tried to access a sale that was not owned by the current user');
    return <NamedRedirect name="InboxPage" params={{ tab: 'sales' }} />;
  }

  const detailsProps = {
    subtotalPrice: currentTransaction.attributes.total,
    commission: currentTransaction.attributes.commission,
    saleState: currentTransaction.attributes.state,
    lastTransitionedAt: currentTransaction.attributes.lastTransitionedAt,
    listing: currentListing,
    booking: ensureBooking(currentTransaction.booking),
    customer: ensureUser(currentTransaction.customer),
  };

  const detailsClassName = classNames(css.tabContent, {
    [css.tabContentVisible]: props.tab === 'details',
  });

  const panel = isDataAvailable && currentTransaction.id
    ? <SaleDetailsPanel className={detailsClassName} {...detailsProps} />
    : <h1 className={css.title}><FormattedMessage id="SalePage.loadingData" /></h1>;

  const isPreauthorizedState = currentTransaction.attributes.state ===
    propTypes.TX_STATE_PREAUTHORIZED;
  const actionButtons = isDataAvailable && isPreauthorizedState
    ? <div className={css.actionButtons}>
        <Button className={css.rejectButton} onClick={() => onRejectSale(currentTransaction.id)}>
          <FormattedMessage id="SalePage.rejectButton" />
        </Button>
        <Button className={css.acceptButton} onClick={() => onAcceptSale(currentTransaction.id)}>
          <FormattedMessage id="SalePage.acceptButton" />
        </Button>
      </div>
    : null;

  return (
    <PageLayout title={intl.formatMessage({ id: 'SalePage.title' }, { title })}>
      {panel}
      {actionButtons}
    </PageLayout>
  );
};

SalePageComponent.defaultProps = { transaction: null, currentUser: null };

const { func, oneOf } = PropTypes;

SalePageComponent.propTypes = {
  currentUser: propTypes.currentUser,
  intl: intlShape.isRequired,
  onAcceptSale: func.isRequired,
  onRejectSale: func.isRequired,
  tab: oneOf(['details', 'discussion']).isRequired,
  transaction: propTypes.transaction,
};

const mapStateToProps = state => {
  const transactionRef = state.SalePage.transactionRef;
  const transactions = getEntities(state.data, transactionRef ? [transactionRef] : []);
  const transaction = transactions.length > 0 ? transactions[0] : null;
  return {
    transaction,
    showSaleError: state.ListingPage.showListingError,
    currentUser: state.user.currentUser,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    onAcceptSale: transactionId => dispatch(acceptSale(transactionId)),
    onRejectSale: transactionId => dispatch(rejectSale(transactionId)),
  };
};

const SalePage = compose(connect(mapStateToProps, mapDispatchToProps), injectIntl)(
  SalePageComponent
);

SalePage.loadData = loadData;

export default SalePage;
