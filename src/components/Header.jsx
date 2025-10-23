import React from 'react';
import { getVersionDisplay } from '../utils/version';
import logoUrl from '/assets/images/logo.png';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <img src={logoUrl} alt="Project Creator Logo" className="header-logo" />
          <div className="header-title">
            <h1>Project Creator</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="header-version">{getVersionDisplay()}</div>
        </div>
      </div>
    </header>
  );
}

export default Header;
