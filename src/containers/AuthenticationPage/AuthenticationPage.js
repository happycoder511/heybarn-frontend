import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter, Redirect } from 'react-router-dom';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import classNames from 'classnames';
import config from '../../config';
import * as propTypes from '../../util/propTypes';
import { ensureCurrentUser } from '../../util/data';
import {
  isSignupEmailTakenError,
  isTooManyEmailVerificationRequestsError,
} from '../../util/errors';
import {
  Page,
  NamedLink,
  NamedRedirect,
  TabNavHorizontal,
  IconEmailSent,
  InlineTextButton,
  IconClose,
  LayoutSingleColumn,
  LayoutWrapperTopbar,
  LayoutWrapperMain,
  LayoutWrapperFooter,
  Footer,
} from '../../components';
import { LoginForm, SignupForm, TopbarContainer } from '../../containers';
import { login, authenticationInProgress, signup } from '../../ducks/Auth.duck';
import { isScrollingDisabled } from '../../ducks/UI.duck';
import { sendVerificationEmail } from '../../ducks/user.duck';

import css from './AuthenticationPage.css';

export class AuthenticationPageComponent extends Component {
  render() {
    const {
      authInProgress,
      currentUser,
      intl,
      isAuthenticated,
      location,
      loginError,
      logoutError,
      scrollingDisabled,
      signupError,
      submitLogin,
      submitSignup,
      tab,
      sendVerificationEmailInProgress,
      sendVerificationEmailError,
      onResendVerificationEmail,
    } = this.props;
    const isLogin = tab === 'login';
    const from = location.state && location.state.from ? location.state.from : null;

    const user = ensureCurrentUser(currentUser);
    const currentUserLoaded = !!user.id;

    // We only want to show the email verification dialog in the signup
    // tab if the user isn't being redirected somewhere else
    // (i.e. `from` is present). We must also check the `emailVerified`
    // flag only when the current user is fully loaded.
    const showEmailVerification = !isLogin && currentUserLoaded && !user.attributes.emailVerified;

    // Already authenticated, redirect away from auth page
    if (isAuthenticated && from) {
      return <Redirect to={from} />;
    } else if (isAuthenticated && currentUserLoaded && !showEmailVerification) {
      return <NamedRedirect name="LandingPage" />;
    }

    /* eslint-disable no-console */
    if (loginError && console && console.error) {
      console.error(loginError);
    }
    if (signupError && console && console.error) {
      console.error(signupError);
    }
    /* eslint-enable no-console */

    const loginErrorMessage = (
      <div className={css.error}>
        <FormattedMessage id="AuthenticationPage.loginFailed" />
      </div>
    );

    const signupErrorMessage = (
      <div className={css.error}>
        {isSignupEmailTakenError(signupError) ? (
          <FormattedMessage id="AuthenticationPage.signupFailedEmailAlreadyTaken" />
        ) : (
          <FormattedMessage id="AuthenticationPage.signupFailed" />
        )}
      </div>
    );

    // eslint-disable-next-line no-confusing-arrow
    const errorMessage = (error, message) => (error ? message : null);
    const loginOrSignupError = isLogin
      ? errorMessage(loginError, loginErrorMessage)
      : errorMessage(signupError, signupErrorMessage);

    const fromState = { state: from ? { from } : null };

    const tabs = [
      {
        text: (
          <h1 className={css.tab}>
            <FormattedMessage id="AuthenticationPage.signupLinkText" />
          </h1>
        ),
        selected: !isLogin,
        linkProps: {
          name: 'SignupPage',
          to: fromState,
        },
      },
      {
        text: (
          <h1 className={css.tab}>
            <FormattedMessage id="AuthenticationPage.loginLinkText" />
          </h1>
        ),
        selected: isLogin,
        linkProps: {
          name: 'LoginPage',
          to: fromState,
        },
      },
    ];

    const formContent = (
      <div className={css.content}>
        <TabNavHorizontal className={css.tabs} tabs={tabs} />
        {loginOrSignupError}
        {isLogin ? (
          <LoginForm className={css.form} onSubmit={submitLogin} inProgress={authInProgress} />
        ) : (
          <SignupForm className={css.form} onSubmit={submitSignup} inProgress={authInProgress} />
        )}
      </div>
    );

    const name = user.attributes.profile.firstName;
    const email = <span className={css.email}>{user.attributes.email}</span>;

    const resendEmailLink = (
      <InlineTextButton className={css.modalHelperLink} onClick={onResendVerificationEmail}>
        <FormattedMessage id="AuthenticationPage.resendEmailLinkText" />
      </InlineTextButton>
    );
    const fixEmailLink = (
      <NamedLink className={css.modalHelperLink} name="ContactDetailsPage">
        <FormattedMessage id="AuthenticationPage.fixEmailLinkText" />
      </NamedLink>
    );

    const resendErrorTranslationId = isTooManyEmailVerificationRequestsError(
      sendVerificationEmailError
    )
      ? 'AuthenticationPage.resendFailedTooManyRequests'
      : 'AuthenticationPage.resendFailed';
    const resendErrorMessage = sendVerificationEmailError ? (
      <p className={css.error}>
        <FormattedMessage id={resendErrorTranslationId} />
      </p>
    ) : null;

    const emailVerificationContent = (
      <div className={css.content}>
        <NamedLink className={css.verifyClose} name="ProfileSettingsPage">
          <span className={css.closeText}>
            <FormattedMessage id="AuthenticationPage.verifyEmailClose" />
          </span>
          <IconClose rootClassName={css.closeIcon} />
        </NamedLink>
        <IconEmailSent className={css.modalIcon} />
        <h1 className={css.modalTitle}>
          <FormattedMessage id="AuthenticationPage.verifyEmailTitle" values={{ name }} />
        </h1>
        <p className={css.modalMessage}>
          <FormattedMessage id="AuthenticationPage.verifyEmailText" values={{ email }} />
        </p>
        {resendErrorMessage}

        <div className={css.bottomWrapper}>
          <p className={css.modalHelperText}>
            {sendVerificationEmailInProgress ? (
              <FormattedMessage id="AuthenticationPage.sendingEmail" />
            ) : (
              <FormattedMessage id="AuthenticationPage.resendEmail" values={{ resendEmailLink }} />
            )}
          </p>
          <p className={css.modalHelperText}>
            <FormattedMessage id="AuthenticationPage.fixEmail" values={{ fixEmailLink }} />
          </p>
        </div>
      </div>
    );

    const siteTitle = config.siteTitle;
    const schemaTitle = isLogin
      ? intl.formatMessage({ id: 'AuthenticationPage.schemaTitleLogin' }, { siteTitle })
      : intl.formatMessage({ id: 'AuthenticationPage.schemaTitleSignup' }, { siteTitle });

    const topbarClasses = classNames({
      [css.hideOnMobile]: showEmailVerification,
    });

    return (
      <Page
        logoutError={logoutError}
        title={schemaTitle}
        scrollingDisabled={scrollingDisabled}
        schema={{
          '@context': 'http://schema.org',
          '@type': 'WebPage',
          name: schemaTitle,
        }}
      >
        <LayoutSingleColumn>
          <LayoutWrapperTopbar>
            <TopbarContainer className={topbarClasses} />
          </LayoutWrapperTopbar>
          <LayoutWrapperMain className={css.layoutWrapperMain}>
            <div className={css.root}>
              {showEmailVerification ? emailVerificationContent : formContent}
            </div>
          </LayoutWrapperMain>
          <LayoutWrapperFooter>
            <Footer />
          </LayoutWrapperFooter>
        </LayoutSingleColumn>
      </Page>
    );
  }
}

AuthenticationPageComponent.defaultProps = {
  currentUser: null,
  loginError: null,
  logoutError: null,
  signupError: null,
  tab: 'signup',
  sendVerificationEmailError: null,
};

const { bool, func, object, oneOf, shape } = PropTypes;

AuthenticationPageComponent.propTypes = {
  authInProgress: bool.isRequired,
  currentUser: propTypes.currentUser,
  isAuthenticated: bool.isRequired,
  loginError: propTypes.error,
  logoutError: propTypes.error,
  scrollingDisabled: bool.isRequired,
  signupError: propTypes.error,
  submitLogin: func.isRequired,
  submitSignup: func.isRequired,
  tab: oneOf(['login', 'signup']),

  sendVerificationEmailInProgress: bool.isRequired,
  sendVerificationEmailError: propTypes.error,
  onResendVerificationEmail: func.isRequired,

  // from withRouter
  location: shape({ state: object }).isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const mapStateToProps = state => {
  const { isAuthenticated, loginError, logoutError, signupError } = state.Auth;
  const { currentUser, sendVerificationEmailInProgress, sendVerificationEmailError } = state.user;
  return {
    authInProgress: authenticationInProgress(state),
    currentUser,
    isAuthenticated,
    loginError,
    logoutError,
    scrollingDisabled: isScrollingDisabled(state),
    signupError,
    sendVerificationEmailInProgress,
    sendVerificationEmailError,
  };
};

const mapDispatchToProps = dispatch => ({
  submitLogin: ({ email, password }) => dispatch(login(email, password)),
  submitSignup: params => dispatch(signup(params)),
  onResendVerificationEmail: () => dispatch(sendVerificationEmail()),
});

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const AuthenticationPage = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
  injectIntl
)(AuthenticationPageComponent);

export default AuthenticationPage;
