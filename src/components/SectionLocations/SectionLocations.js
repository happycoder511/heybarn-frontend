import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import classNames from 'classnames';

import { NamedLink } from '../../components';

import css from './SectionLocations.css';

import helsinkiImage from '../../assets/location_helsinki.jpg';
import rovaniemiImage from '../../assets/location_rovaniemi.jpg';
import rukaImage from '../../assets/location_ruka.jpg';

const location = (name, image, searchQuery) => {
  const nameText = <span className={css.locationName}>{name}</span>;
  return (
    <NamedLink name="SearchPage" to={{ search: searchQuery }} className={css.location}>
      <div className={css.imageWrapper}>
        <div className={css.aspectWrapper}>
          <img src={image} alt={name} className={css.locationImage} />
        </div>
      </div>
      <div className={css.linkText}>
        <FormattedMessage
          id="SectionLocations.listingsInLocation"
          values={{ location: nameText }}
        />
      </div>
    </NamedLink>
  );
};

const SectionLocations = props => {
  const { rootClassName, className } = props;

  const classes = classNames(rootClassName || css.root, className);

  return (
    <div className={classes}>
      <div className={css.content}>
        <div className={css.titleWrapper}>
          <h1 className={css.title}>
            <FormattedMessage id="SectionLocations.title" />
          </h1>
        </div>
        <div className={css.subtitleWrapper}>
          <p>
            <FormattedMessage id="SectionLocations.subtitle" />
          </p>
        </div>
        <div className={css.locations}>
          {location(
            'Helsinki',
            helsinkiImage,
            '?address=Helsinki%2C%20Finland&bounds=60.2978389%2C25.254484899999966%2C59.9224887%2C24.782875800000056&country=FI&origin=60.16985569999999%2C24.93837910000002'
          )}
          {location(
            'Rovaniemi',
            rovaniemiImage,
            '?address=Rovaniemi%2C%20Finland&bounds=67.18452510000002%2C27.32667850000007%2C66.1553745%2C24.736871199999996&country=FI&origin=66.50394779999999%2C25.729390599999988'
          )}
          {location(
            'Ruka',
            rukaImage,
            '?address=Ruka%2C%20Finland&bounds=66.1704578%2C29.14246849999995%2C66.1614402%2C29.110453699999994&country=FI&origin=66.16594940000002%2C29.12646110000003'
          )}
        </div>
      </div>
    </div>
  );
};

SectionLocations.defaultProps = { rootClassName: null, className: null };

const { string } = PropTypes;

SectionLocations.propTypes = {
  rootClassName: string,
  className: string,
};

export default SectionLocations;
