import React from 'react';
import { arrayOf, bool, func, shape, string } from 'prop-types';
import { compose } from 'redux';
import { Form as FinalForm } from 'react-final-form';
import { intlShape, injectIntl, FormattedMessage } from '../../util/reactIntl';
import classNames from 'classnames';
import { propTypes } from '../../util/types';
import {
  maxLength,
  required,
  composeValidators,
  nonEmptyArray,
  requiredObject,
} from '../../util/validators';
import { Form, Button, FieldTextInput, CustomSelect } from '../../components';
import * as yup from 'yup';
import css from './EditListingDescriptionForm.module.css';

const TITLE_MAX_LENGTH = 60;
const validationSchema = yup.object({
  title: yup.string().required(),
  description: yup.string().required(),
  preferredUse: yup.lazy(val => {
    console.log(val);
    return Array.isArray(val)
      ? yup
          .array()
          .of(
            yup.object({
              key: yup.string(),
              label: yup.string(),
            })
          )
          .required()
      : yup
          .object({
            key: yup.string(),
            label: yup.string(),
          })
          .required();
  }),

  // preferredUse: yup.mixed().when('isArray', {
  //   is: Array.isArray,
  //   then: yup.array().of(
  //     yup.object({
  //       key: yup.string(),
  //       label: yup.string(),
  //     })
  //   ),
  //   otherwise: yup
  //     .object({
  //       key: yup.string(),
  //       label: yup.string(),
  //     })
  //     .required(),
  // }),
});

// To be passed to React Final Form
const validateFormValues = schema => async values => {
  if (typeof schema === 'function') {
    schema = schema();
  }
  try {
    await schema.validate(values, { abortEarly: false });
  } catch (err) {
    console.log('🚀 | file: EditListingDescriptionForm.js | line 35 | err', err);
    const errors = err.inner.reduce((formError, innerError) => {
      return setIn(formError, innerError.path, innerError.message);
    }, {});

    return errors;
  }
};
const validate = validateFormValues(validationSchema);

const EditListingDescriptionFormComponent = props => (
  <FinalForm
    {...props}
    validate={validate}
    render={formRenderProps => {
      const {
        preferredUse,
        className,
        disabled,
        ready,
        handleSubmit,
        intl,
        invalid,
        pristine,
        saveActionMsg,
        updated,
        updateInProgress,
        fetchErrors,
        listingType,
      } = formRenderProps;
      console.log(
        '🚀 | file: EditListingDescriptionForm.js | line 36 | formRenderProps',
        formRenderProps
      );
      console.log('🚀 | file: EditListingDescriptionForm.js | line 36 | listingType', listingType);

      const titleMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.title',
      });
      const titlePlaceholderMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.titlePlaceholder',
      });
      const titleRequiredMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.titleRequired',
      });
      const maxLengthMessage = intl.formatMessage(
        { id: 'EditListingDescriptionForm.maxLength' },
        {
          maxLength: TITLE_MAX_LENGTH,
        }
      );

      const preferredUseLabel = intl.formatMessage({
        id: 'EditListingDescriptionForm.preferredUseLabel',
      });
      const preferredUseRequiredMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.preferredUseRequired',
      });
      const descriptionMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.description',
      });
      const descriptionPlaceholderMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.descriptionPlaceholder',
      });
      const maxLength60Message = maxLength(maxLengthMessage, TITLE_MAX_LENGTH);
      const descriptionRequiredMessage = intl.formatMessage({
        id: 'EditListingDescriptionForm.descriptionRequired',
      });

      const { updateListingError, createListingDraftError, showListingsError } = fetchErrors || {};
      const errorMessageUpdateListing = updateListingError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingDescriptionForm.updateFailed" />
        </p>
      ) : null;

      // This error happens only on first tab (of EditListingWizard)
      const errorMessageCreateListingDraft = createListingDraftError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingDescriptionForm.createListingDraftError" />
        </p>
      ) : null;

      const errorMessageShowListing = showListingsError ? (
        <p className={css.error}>
          <FormattedMessage id="EditListingDescriptionForm.showListingFailed" />
        </p>
      ) : null;

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      const submitDisabled = invalid || disabled || submitInProgress;
      console.log(
        '🚀 | file: EditListingDescriptionForm.js | line 127 | submitDisabled',
        submitDisabled
      );

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          {errorMessageCreateListingDraft}
          {errorMessageUpdateListing}
          {errorMessageShowListing}
          <FieldTextInput
            id="title"
            name="title"
            className={css.title}
            type="text"
            label={titleMessage}
            placeholder={titlePlaceholderMessage}
            maxLength={TITLE_MAX_LENGTH}
            validate={composeValidators(required(titleRequiredMessage), maxLength60Message)}
            autoFocus
          />

          <FieldTextInput
            id="description"
            name="description"
            className={css.description}
            type="textarea"
            label={descriptionMessage}
            placeholder={descriptionPlaceholderMessage}
            validate={composeValidators(required(descriptionRequiredMessage))}
          />
          <CustomSelect
            id="preferredUse"
            name="preferredUse"
            className={css.description}
            options={preferredUse}
            label={preferredUseLabel}
            isMulti={listingType === 'listing'}
            validate={
              listingType === 'listing'
                ? nonEmptyArray(preferredUseRequiredMessage)
                : requiredObject(preferredUseRequiredMessage)
            }
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

EditListingDescriptionFormComponent.defaultProps = { className: null, fetchErrors: null };

EditListingDescriptionFormComponent.propTypes = {
  className: string,
  intl: intlShape.isRequired,
  onSubmit: func.isRequired,
  saveActionMsg: string.isRequired,
  disabled: bool.isRequired,
  ready: bool.isRequired,
  updated: bool.isRequired,
  updateInProgress: bool.isRequired,
  fetchErrors: shape({
    createListingDraftError: propTypes.error,
    showListingsError: propTypes.error,
    updateListingError: propTypes.error,
  }),
  categories: arrayOf(
    shape({
      key: string.isRequired,
      label: string.isRequired,
    })
  ),
};

export default compose(injectIntl)(EditListingDescriptionFormComponent);
