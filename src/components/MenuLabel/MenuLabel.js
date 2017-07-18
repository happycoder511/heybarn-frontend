/**
 * MenuLabel is the only always visible part of Menu.
 * Clicking it toggles visibility of MenuContent.
 */
import React, { Component, PropTypes } from 'react';
import classNames from 'classnames';

import css from './MenuLabel.css';

class MenuLabel extends Component {
  constructor(props) {
    super(props);

    this.state = { clickedWithMouse: false };
    this.onClick = this.onClick.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }

  onClick(e) {
    this.props.onToggleActive();

    // Don't show focus outline if user just clicked the element with mouse
    // tab + enter creates also a click event, but its location is origin.
    const nativeEvent = e.nativeEvent;
    const isRealClick = !(nativeEvent.clientX === 0 && nativeEvent.clientY === 0);
    if (isRealClick) {
      this.setState({ clickedWithMouse: true });
    }
  }

  onBlur() {
    this.setState(() => {
      return { clickedWithMouse: false };
    });
  }

  render() {
    const { children, className, rootClassName } = this.props;

    const rootClass = rootClassName || css.root;
    const classes = classNames(rootClass, className, {
      [css.clickedWithMouse]: this.state.clickedWithMouse,
    });

    return (
      <button className={classes} onClick={this.onClick} onBlur={this.onBlur}>
        {children}
      </button>
    );
  }
}
/* eslint-enable jsx-a11y/no-static-element-interactions */

MenuLabel.defaultProps = {
  className: null,
  isOpen: false,
  onToggleActive: null,
  rootClassName: '',
};

const { func, node, string } = PropTypes;

MenuLabel.propTypes = {
  children: node.isRequired,
  className: string,
  onToggleActive: func,
  rootClassName: string,
};

export default MenuLabel;
