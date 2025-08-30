import React from 'react';
import { getVersionDisplay } from '../utils/version';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <img src="logo.png" alt="Project Creator Logo" className="header-logo" />
          <div className="header-title">
            <h1>Project Creator</h1>
            <span className="header-subtitle">Electron Edition</span>
          </div>
        </div>
        <div className="header-right">
          <div className="header-version">{getVersionDisplay()}</div>
          <div className="header-status">
            <span className="status-indicator online"></span>
            <span className="status-text">Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
