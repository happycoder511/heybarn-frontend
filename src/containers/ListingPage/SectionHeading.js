import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { InlineTextButton } from '../../components';
import { LINE_ITEM_NIGHT, LINE_ITEM_DAY } from '../../util/types';
import config from '../../config';
import { capitalize } from 'lodash';

import css from './ListingPage.module.css';
import { ensureArray } from '../../util/devHelpers';

const SectionHeading = props => {
  const {
    richTitle,
    hostLink,
    region,
    preferredUse,
    listingType,
    priceTitle,
    formattedPrice,
  } = props;
  console.log('🚀 | file: SectionHeading.js | line 23 | formattedPrice', formattedPrice);
  console.log('🚀 | file: SectionHeading.js | line 23 | priceTitle', priceTitle);
  return (
    <div className={css.sectionHeading}>
      <div className={css.heading}>
        <h1 className={css.title}>{richTitle}</h1>
        <div className={css.author}>
          {listingType === 'listing' && (
            <div className={css.priceContainer}>
              <div className={css.priceValue} title={priceTitle}>
                {formattedPrice}/wk
              </div>
            </div>
          )}
          <div>
            <FormattedMessage
              id={`ListingPage.${listingType}By`}
              values={{ name: hostLink, region: (region && capitalize(region)) || 'NZ' }}
            />
          </div>
          <div>
            <FormattedMessage
              id={`ListingPage.${listingType}IdealFor`}
              values={{ uses: ensureArray(preferredUse)?.join(' | ') }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionHeading;
