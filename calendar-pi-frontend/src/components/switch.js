import React from "react";
import './switch.css';

const Switch = ({ isOn, handleToggle, checked, onChange }) => {
  const resolvedIsOn = typeof isOn === 'boolean' ? isOn : Boolean(checked);
  const resolvedHandleToggle = typeof handleToggle === 'function' ? handleToggle : onChange;

  return (
    <>
      <input
        checked={resolvedIsOn}
        onChange={resolvedHandleToggle}
        className="react-switch-checkbox"
        id={`react-switch-new`}
        type="checkbox"
      />
      <label
        style={{ background: resolvedIsOn ? '#06D6A0' : undefined }}
        className="react-switch-label"
        htmlFor={`react-switch-new`}
        >
        
        <span className={`react-switch-button`} />
      </label>
    </>
  );
};

export default Switch;