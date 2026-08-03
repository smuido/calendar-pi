import React, { useId } from "react";
import './switch.css';

const Switch = ({ isOn, handleToggle, checked, onChange, id }) => {
  const autoId = useId();
  const switchId = id ?? autoId;
  const resolvedIsOn = typeof isOn === 'boolean' ? isOn : Boolean(checked);
  const resolvedHandleToggle = typeof handleToggle === 'function' ? handleToggle : onChange;

  return (
    <>
      <input
        checked={resolvedIsOn}
        onChange={resolvedHandleToggle}
        className="react-switch-checkbox"
        id={switchId}
        type="checkbox"
      />
      <label
        style={{ background: resolvedIsOn ? '#06D6A0' : undefined }}
        className="react-switch-label"
        htmlFor={switchId}
        >
        
        <span className={`react-switch-button`} />
      </label>
    </>
  );
};

export default Switch;