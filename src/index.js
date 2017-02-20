/**
 * This is the main entrypoint file for the application.
 *
 * When loaded in the client side, the application is rendered in the
 * #root element.
 *
 * When the bundle created from this file is imported in the server
 * side, the exported `renderApp` function can be used for server side
 * rendering.
 *
 * Note that this file is required for the build process.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { createInstance, types } from 'sharetribe-sdk';
import { ClientApp, renderApp } from './app';
import configureStore from './store';
import { matchPathname } from './util/routes';
import createRootSaga from './sagas';
import config from './config';

import './index.css';

// If we're in a browser already, render the client application.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-underscore-dangle
  const preloadedState = window.__PRELOADED_STATE__ || {};
  const store = configureStore(preloadedState);
  const sdk = createInstance({ clientId: config.sdk.clientId, baseUrl: config.sdk.baseUrl });

  store.runSaga(createRootSaga(sdk));

  ReactDOM.render(<ClientApp store={store} />, document.getElementById('root'));

  // Expose stuff for the browser REPL
  if (config.dev) {
    window.app = { config, sdk, sdkTypes: types };
  }
}

// Export the function for server side rendering.
export default renderApp;

// exporting matchPathname and configureStore for server side rendering.
// matchPathname helps to figure out which route is called and if it has preloading needs
// configureStore is used for creating initial store state for Redux after preloading
export { matchPathname, configureStore };
