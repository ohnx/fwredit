/* global mergeInto, LibraryManager, SimulatorAPI */

/* define the JS functions to call the SimulatorAPI */
mergeInto(LibraryManager.library, {
  cc_ledRed: function(status) {
    SimulatorAPI.ledRed(status);
  },
  cc_ledYellow: function(status) {
    SimulatorAPI.ledYellow(status);
  },
  cc_ledGreen: function(status) {
    SimulatorAPI.ledGreen(status);
  },
  cc_leftMotorSpeed: function(speed) {
    SimulatorAPI.Motors.setLeftSpeed(speed);
  },
  cc_rightMotorSpeed: function(speed) {
    SimulatorAPI.Motors.setRightSpeed(speed);
  },
  cc_serialWrite: function(byte) {
    SimulatorAPI.serialPrint(String.fromCharCode(byte));
  },
  cc_buttonPressed: function(nbr) {
    return SimulatorAPI.getButtonState(nbr);
  }
});
