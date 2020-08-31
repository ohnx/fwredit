// CS10 / C510
#include <Romi32U4.h>

#define LEFT_SENSOR A2
#define RIGHT_SENSOR A0
#define MOVEMENT_SPEED 200
#define SMALL_MOVEMENT_SPEED 100
#define LEFT_OFFSET 200

Romi32U4Motors motors;
Romi32U4ButtonA buttonA;
Romi32U4ButtonB buttonB;
Romi32U4ButtonC buttonC;
Romi32U4LCD lcd;
int calib_offset = LEFT_OFFSET;

void calibrateSensors() {
  int left_base;
  int right_base;

  while (!buttonA.isPressed()) {
    lcd.clear();
    lcd.gotoXY(0, 0);
    lcd.print("R: ");
    right_base = analogRead(RIGHT_SENSOR);
    lcd.print(right_base);
    lcd.gotoXY(0, 1);
    lcd.print("L: ");
    left_base = analogRead(LEFT_SENSOR);
    lcd.print(left_base);
    delay(100);
  }

  calib_offset = right_base - left_base;

  lcd.clear();
  lcd.print("Calibr8");
  lcd.gotoXY(0, 1);
  lcd.print("O: ");
  lcd.print(calib_offset);

  while(!buttonC.isPressed()) {
    delay(100);
  }

  delay(1000);
}

// Run once, when the sketch starts
void setup() {
  uint16_t batteryLevel;
  pinMode(LEFT_SENSOR, INPUT);
  pinMode(RIGHT_SENSOR, INPUT);

  while (!buttonA.isPressed()) {
    // read the battery level and store it in a variable
    batteryLevel = readBatteryMillivolts();
    
    lcd.clear();  // clear the LCD
    lcd.print("B=");
    lcd.print(batteryLevel); // print the battery voltage 
    lcd.print("mV");
    lcd.gotoXY(0, 1);
    lcd.print("Press A");

    delay(100); // Pause for 100ms
  }
  lcd.clear();

  // Calibration
  lcd.print("Calibr8?");
  lcd.gotoXY(0, 1);
  lcd.print("Y:B N:C");
  while (1) {
    if (buttonC.isPressed()) {
      delay(500);
      break;
    } else if (buttonB.isPressed()) {
      calibrateSensors();
      break;
    } else {
      delay(100);
    }
  }

  lcd.clear();
}

// Run over and over again
void loop()
{
  uint16_t battery_level;
  int left_light;
  int right_light;

  battery_level = readBatteryMillivolts();
  left_light = analogRead(LEFT_SENSOR);
  right_light = analogRead(RIGHT_SENSOR);

  lcd.clear();
  lcd.gotoXY(0, 0);
  lcd.print("B=");
  lcd.print(battery_level); // print the battery voltage 
  lcd.print("mV");
  lcd.gotoXY(0, 1);
  if (left_light - right_light + calib_offset < -30) {
    lcd.print("HI L=");
    lcd.print(left_light);

    motors.setLeftSpeed(SMALL_MOVEMENT_SPEED);
    motors.setRightSpeed(MOVEMENT_SPEED);
  } else if (right_light - left_light - calib_offset < -30) {
    lcd.print("HI R=");
    lcd.print(right_light);

    motors.setLeftSpeed(MOVEMENT_SPEED);
    motors.setRightSpeed(SMALL_MOVEMENT_SPEED);
  } else {
    motors.setLeftSpeed(MOVEMENT_SPEED);
    motors.setRightSpeed(MOVEMENT_SPEED);
  }
 
  delay(100);
}
