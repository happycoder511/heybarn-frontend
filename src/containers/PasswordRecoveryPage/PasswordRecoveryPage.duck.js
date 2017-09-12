// ================ Action types ================ //

export const RECOVERY_REQUEST = 'app/PasswordRecoveryPage/RECOVERY_REQUEST';
export const RECOVERY_SUCCESS = 'app/PasswordRecoveryPage/RECOVERY_SUCCESS';
export const RECOVERY_ERROR = 'app/PasswordRecoveryPage/RECOVERY_ERROR';
export const RETYPE_EMAIL = 'app/PasswordRecoveryPage/RETYPE_EMAIL';

// ================ Reducer ================ //

const initialState = {
  initialEmail: null,
  submittedEmail: null,
  recoveryError: null,
  recoveryInProgress: false,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case RECOVERY_REQUEST:
      return {
        ...state,
        submittedEmail: null,
        initialEmail: null,
        recoveryInProgress: true,
        recoveryError: null,
      };
    case RECOVERY_SUCCESS:
      return { ...state, submittedEmail: payload.email, recoveryInProgress: false };
    case RECOVERY_ERROR:
      return { ...state, recoveryInProgress: false, recoveryError: payload };
    case RETYPE_EMAIL:
      return { ...state, submittedEmail: null, initialEmail: state.submittedEmail };
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const recoveryRequest = () => ({ type: RECOVERY_REQUEST });
export const recoverySuccess = email => ({ type: RECOVERY_SUCCESS, payload: { email } });
export const recoveryError = error => ({
  type: RECOVERY_ERROR,
  payload: error,
  error: true,
});
export const retypeEmail = () => ({ type: RETYPE_EMAIL });

// ================ Thunks ================ //

export const recoverPassword = email =>
  (dispatch, getState, sdk) => {
    dispatch(recoveryRequest());

    return sdk.passwordReset
      .request({ email })
      .then(() => dispatch(recoverySuccess(email)))
      .catch(e => dispatch(recoveryError(e)));
  };
