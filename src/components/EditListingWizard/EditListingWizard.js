import React, { PropTypes } from 'react';
import { injectIntl, intlShape } from 'react-intl';
import classNames from 'classnames';
import * as propTypes from '../../util/propTypes';
import { ensureListing } from '../../util/data';
import { createResourceLocatorString } from '../../util/routes';
import {
  EditListingDescriptionPanel,
  EditListingLocationPanel,
  EditListingPhotosPanel,
  EditListingPricingPanel,
  NamedRedirect,
  Tabs,
} from '../../components';

import css from './EditListingWizard.css';

const DESCRIPTION = 'description';
const LOCATION = 'location';
const PRICING = 'pricing';
const PHOTOS = 'photos';
const STEPS = [DESCRIPTION, LOCATION, PRICING, PHOTOS];

const submitText = (intl, isNew, step) => {
  let key = null;
  if (step === DESCRIPTION) {
    key = isNew ? 'EditListingWizard.saveNewDescription' : 'EditListingWizard.saveEditDescription';
  } else if (step === LOCATION) {
    key = isNew ? 'EditListingWizard.saveNewLocation' : 'EditListingWizard.saveEditLocation';
  } else if (step === PRICING) {
    key = isNew ? 'EditListingWizard.saveNewPricing' : 'EditListingWizard.saveEditPricing';
  } else if (step === PHOTOS) {
    key = isNew ? 'EditListingWizard.saveNewPhotos' : 'EditListingWizard.saveEditPhotos';
  }
  return intl.formatMessage({ id: key });
};

/**
 * Check which wizard steps are active and which are not yet available. Step is active is previous
 * step is completed.
 *
 * @param listing data to be checked
 *
 * @return object containing activity / editability of different steps of this wizard
 */
const stepsActive = listing => {
  const { address, description, geolocation, price, title } = listing.attributes;
  const descriptionStep = !!title && !!description;
  const locationStep = !!address && !!geolocation;
  const pricingStep = !!price;

  // photosStep is about adding listing.images

  return {
    [DESCRIPTION]: true,
    [LOCATION]: descriptionStep,
    [PRICING]: locationStep,
    [PHOTOS]: pricingStep,
  };
};

// TODO remove TestPanel when different wizard forms are available
const TestPanel = props => {
  return <div>{props.children}</div>;
};

TestPanel.propTypes = {
  children: PropTypes.node.isRequired,
};

// Create a new or edit listing through EditListingWizard
const EditListingWizard = props => {
  const {
    className,
    params,
    errors,
    fetchInProgress,
    flattenedRoutes,
    history,
    images,
    listing,
    onCreateListing,
    onCreateListingDraft,
    onImageUpload,
    onPayoutDetailsSubmit,
    onUpdateImageOrder,
    onUpdateListingDraft,
    rootClassName,
    currentUser,
    onManageDisableScrolling,
    intl,
  } = props;

  const isNew = params.type === 'new';
  const selectedTab = params.tab;
  const rootClasses = rootClassName || css.root;
  const classes = classNames(rootClasses, className);
  const currentListing = ensureListing(listing);
  const stepsStatus = stepsActive(currentListing);

  const tabParams = tab => {
    return { ...params, tab };
  };
  const tabLink = tab => {
    return { name: 'EditListingPage', params: tabParams(tab) };
  };

  // If selectedStep is not active, redirect to the beginning of wizard
  if (!stepsStatus[selectedTab]) {
    return <NamedRedirect name="EditListingPage" params={tabParams(DESCRIPTION)} />;
  }

  const onUpsertListingDraft = currentListing.id ? onUpdateListingDraft : onCreateListingDraft;

  return (
    <Tabs rootClassName={classes} navRootClassName={css.nav} tabRootClassName={css.tab}>
      <EditListingDescriptionPanel
        className={css.panel}
        tabLabel="Description"
        tabLinkProps={tabLink(DESCRIPTION)}
        selected={selectedTab === DESCRIPTION}
        disabled={!stepsStatus[DESCRIPTION]}
        listing={listing}
        submitButtonText={submitText(intl, isNew, DESCRIPTION)}
        onSubmit={values => {
          onUpsertListingDraft(values);

          const pathParams = tabParams(LOCATION);
          // Redirect to location tab
          history.push(
            createResourceLocatorString('EditListingPage', flattenedRoutes, pathParams, {})
          );
        }}
      />
      <EditListingLocationPanel
        className={css.panel}
        tabLabel="Location"
        tabLinkProps={tabLink(LOCATION)}
        selected={selectedTab === LOCATION}
        disabled={!stepsStatus[LOCATION]}
        listing={listing}
        submitButtonText={submitText(intl, isNew, LOCATION)}
        onSubmit={values => {
          const { building, location } = values;
          const { selectedPlace: { address, origin } } = location;

          // TODO When API supports building number, etc. change this to use those fields instead.
          onUpdateListingDraft({
            address: JSON.stringify({ locationAddress: address, building }),
            geolocation: origin,
          });

          const pathParams = tabParams(PRICING);
          // Redirect to pricing tab
          history.push(
            createResourceLocatorString('EditListingPage', flattenedRoutes, pathParams, {})
          );
        }}
      />
      <EditListingPricingPanel
        className={css.panel}
        tabLabel="Pricing"
        tabLinkProps={tabLink(PRICING)}
        selected={selectedTab === PRICING}
        disabled={!stepsStatus[PRICING]}
        listing={listing}
        submitButtonText={submitText(intl, isNew, PRICING)}
        onSubmit={values => {
          onUpdateListingDraft(values);

          const pathParams = tabParams(PHOTOS);
          // Redirect to photos tab
          history.push(
            createResourceLocatorString('EditListingPage', flattenedRoutes, pathParams, {})
          );
        }}
      />
      <EditListingPhotosPanel
        className={css.panel}
        tabLabel="Photos"
        tabLinkProps={tabLink(PHOTOS)}
        selected={selectedTab === PHOTOS}
        disabled={!stepsStatus[PHOTOS]}
        errors={errors}
        fetchInProgress={fetchInProgress}
        listing={listing}
        images={images}
        onImageUpload={onImageUpload}
        onPayoutDetailsSubmit={onPayoutDetailsSubmit}
        submitButtonText={submitText(intl, isNew, PHOTOS)}
        onSubmit={values => {
          const { country, images: updatedImages } = values;
          onCreateListing({ ...listing.attributes, country, images: updatedImages });
        }}
        onUpdateImageOrder={onUpdateImageOrder}
        currentUser={currentUser}
        onManageDisableScrolling={onManageDisableScrolling}
      />
    </Tabs>
  );
};

EditListingWizard.defaultProps = {
  className: null,
  errors: null,
  listing: null,
  rootClassName: null,
  currentUser: null,
};

const { array, arrayOf, bool, func, object, oneOf, shape, string } = PropTypes;

EditListingWizard.propTypes = {
  className: string,
  params: shape({
    id: string.isRequired,
    slug: string.isRequired,
    type: oneOf(['new', 'edit']).isRequired,
    tab: oneOf(STEPS).isRequired,
  }).isRequired,
  errors: shape({
    createListingsError: object,
    showListingsError: object,
    uploadImageError: object,
  }),
  fetchInProgress: bool.isRequired,
  flattenedRoutes: arrayOf(propTypes.route).isRequired,
  history: shape({
    push: func.isRequired,
  }).isRequired,
  images: array.isRequired,
  listing: shape({
    // TODO Should be propTypes.listing after API support is added.
    attributes: shape({
      address: string,
      description: string,
      geolocation: object,
      pricing: object,
      title: string,
    }),
    images: array,
  }),
  onCreateListing: func.isRequired,
  onCreateListingDraft: func.isRequired,
  onImageUpload: func.isRequired,
  onPayoutDetailsSubmit: func.isRequired,
  onUpdateImageOrder: func.isRequired,
  onUpdateListingDraft: func.isRequired,
  rootClassName: string,
  currentUser: propTypes.currentUser,
  onManageDisableScrolling: func.isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

export default injectIntl(EditListingWizard);
