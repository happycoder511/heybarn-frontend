/* eslint-disable no-console */
import ReviewForm from './ReviewForm';

export const Empty = {
  component: ReviewForm,
  props: {
    onSubmit: values => {
      console.log('Submit ReviewForm with (unformatted) values:', values);
    },
    reviewSent: false,
    sendReviewInProgress: false,
  },
  group: 'forms',
};
