import React from 'react';
import { bool, func, shape, string } from 'prop-types';
import config from '../../config';
import { compose } from 'redux';
import { Form as FinalForm, FormSpy } from 'react-final-form';
import { intlShape, injectIntl, FormattedMessage } from '../../util/reactIntl';
import classNames from 'classnames';
import { propTypes } from '../../util/types';
import {
  autocompleteSearchRequired,
  autocompletePlaceSelected,
  composeValidators,
} from '../../util/validators';
import { Form, LocationAutocompleteInputField, Button, FieldSelect } from '../../components';

import css from './EditListingLocationForm.module.css';

const identity = v => v;

export const EditListingLocationFormComponent = props => (
  <FinalForm
    {...props}
    render={formRenderProps => {
      const {
        className,
        disabled,
        ready,
        form,
        handleSubmit,
        intl,
        initialValues,
        invalid,
        pristine,
        saveActionMsg,
        updated,
        updateInProgress,
        fetchErrors,
        values,
      } = formRenderProps;
      console.log('🚀 | file: EditListingLocationForm.js | line 41 | initialValues', initialValues);
      const titleRequiredMessage = intl.formatMessage({ id: 'EditListingLocationForm.address' });
      const addressPlaceholderMessage = intl.formatMessage({
        id: 'EditListingLocationForm.addressPlaceholder',
      });
      const addressRequiredMessage = intl.formatMessage({
        id: 'EditListingLocationForm.addressRequired',
      });
      const addressNotRecognizedMessage = intl.formatMessage({
        id: 'EditListingLocationForm.addressNotRecognized',
      });

      const { updateListingError, showListingsError } = fetchErrors || {};
      const errorMessage = updateListingError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingLocationForm.updateFailed" />
        </p>
      ) : null;

      const errorMessageShowListing = showListingsError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingLocationForm.showListingFailed" />
        </p>
      ) : null;

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      const submitDisabled = invalid || disabled || submitInProgress;
      const filterConfig = config.custom.filters;
      const islandConfig = filterConfig.find(f => f.id === 'locIsland');
      const islands = islandConfig?.config.options;
      const regionConfig = filterConfig.find(f => f.id === 'locRegion');
      const regions = regionConfig?.config.options;
      const districtConfig = filterConfig.find(f => f.id === 'locDistrict');
      const districts = districtConfig.config.options;
      const filteredRegions = regions?.filter(r => r.parent === values?.locIsland);
      const filteredDistricts = districts?.filter(r => r.parent === values?.locRegion);

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          {errorMessage}
          {errorMessageShowListing}
          <FormSpy
            subscription={{ values: true }}
            onChange={val => {
              console.log('🚀 | file: EditListingLocationForm.js | line 105 | form', values);
              console.log('🚀 | file: EditListingLocationForm.js | line 105 | val', val);
              if (val?.values?.locIsland !== values?.locIsland) {
                form.change('locRegion', null);
                form.change('locDistrict', null);
              }
              if (val?.values?.locRegion !== values?.locRegion) {
                form.change('locDistrict', null);
              }
            }}
          />

          <div className={css.regionWrapper}>
            <h2 className={css.title}>Where is this listing located?</h2>

            <FieldSelect
              className={css.category}
              name={'locIsland'}
              id={'locIsland'}
              label={'Island'}
            >
              <option disabled value="">
                {'Select Island'}
              </option>
              {islands.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              className={css.category}
              name={'locRegion'}
              id={'locRegion'}
              label={'Region'}
            >
              <option disabled value="">
                {'Select Region'}
              </option>
              {filteredRegions.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              className={css.category}
              name={'locDistrict'}
              id={'locDistrict'}
              label={'District'}
            >
              <option disabled value="">
                {'Select District'}
              </option>
              {filteredDistricts.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </FieldSelect>
          </div>

          <LocationAutocompleteInputField
            className={css.locationAddress}
            inputClassName={css.locationAutocompleteInput}
            iconClassName={css.locationAutocompleteInputIcon}
            predictionsClassName={css.predictionsRoot}
            validClassName={css.validLocation}
            autoFocus
            name="location"
            label={titleRequiredMessage}
            placeholder={addressPlaceholderMessage}
            useDefaultPredictions={false}
            format={identity}
            valueFromForm={values.location}
            validate={composeValidators(
              autocompleteSearchRequired(addressRequiredMessage),
              autocompletePlaceSelected(addressNotRecognizedMessage)
            )}
          />

          <Button
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
            ready={submitReady}
          >
            {saveActionMsg}
          </Button>
        </Form>
      );
    }}
  />
);

EditListingLocationFormComponent.defaultProps = {
  selectedPlace: null,
  fetchErrors: null,
};

EditListingLocationFormComponent.propTypes = {
  intl: intlShape.isRequired,
  onSubmit: func.isRequired,
  saveActionMsg: string.isRequired,
  selectedPlace: propTypes.place,
  disabled: bool.isRequired,
  ready: bool.isRequired,
  updated: bool.isRequired,
  updateInProgress: bool.isRequired,
  fetchErrors: shape({
    showListingsError: propTypes.error,
    updateListingError: propTypes.error,
  }),
};

export default compose(injectIntl)(EditListingLocationFormComponent);
