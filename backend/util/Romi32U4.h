// Hacked-together implementation of some of the key functionality of the Romi
// Portions of this code are copyrighted by Pololu Corporation and distributed
// under the following license
/*
Copyright (c) 2017 Pololu Corporation.  For more information, see

http://www.pololu.com/
http://forum.pololu.com/

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

/*! \file Romi32U4.h
 *
 * \brief Main header file for the Romi32U4 library.
 *
 * This file includes all the other headers files provided by the library.
 */

#pragma once
#include <cstdint>

// All of the C functions
extern "C" {
    void cc_ledRed(int status);
    void cc_ledYellow(int status);
    void cc_ledGreen(int status);
    void cc_leftMotorSpeed(int speed);
    void cc_rightMotorSpeed(int speed);
    void cc_serialWrite(unsigned char byte);
    int cc_buttonPressed(int btnNbr);
};

/* main arduino api code */
#include <emscripten.h>
/** \brief Sleep for a brief period of time
 */
void delay(unsigned long ms) {
    emscripten_sleep(ms);
}

// TODO: analogRead

#include <string>  

/* Serial emulator code */
class EmulatedSerialDevice {
    public:
        void begin(int baud) {
            (void)baud;
        }

        void write(const unsigned char byte) {
            cc_serialWrite(byte);
        }

        void print(const char *data) {
            while (*data) {
                cc_serialWrite(*(data++));
            }
        }
        
        void print(float data) {
            print(std::to_string(data).c_str());
        }

        void print(int data) {
            print(std::to_string(data).c_str());
        }

        void print(char data) {
            write(data);
        }

        void println(const char *data) {
            while (*data) {
                cc_serialWrite(*(data++));
            }
            cc_serialWrite('\n');
        }

        void println(float data) {
            println(std::to_string(data).c_str());
        }

        void println(int data) {
            println(std::to_string(data).c_str());
        }

        void println(char data) {
            cc_serialWrite(data);
            cc_serialWrite('\n');
        }

        /* TODO: read */
        bool available() {
            return false;
        }

        unsigned char read() {
            return 0;
        }
};
EmulatedSerialDevice Serial;

/*! \brief Turns the red user LED (RX) on or off.

@param on 1 to turn on the LED, 0 to turn it off. */
void ledRed(bool on)
{
    cc_ledRed(on);
    delay(1); // always give the rest of the js code time to execute
}

/*! \brief Turns the yellow user LED on pin 13 on or off.

@param on 1 to turn on the LED, 0 to turn it off. */
void ledYellow(bool on)
{
    cc_ledYellow(on);
    delay(1); // always give the rest of the js code time to execute
}

/*! \brief Turns the green user LED (TX) on or off.

@param on 1 to turn on the LED, 0 to turn it off. */
void ledGreen(bool on)
{
    cc_ledGreen(on);
    delay(1); // always give the rest of the js code time to execute
}

/*! \brief Return false.

This function returns true if power is detected on the board's USB port and
returns false otherwise.  Since we are in a virtual environment, we always
return false.  */
inline bool usbPowerPresent()
{
    return false;
}

/*! \brief Reads the battery voltage and returns it in millivolts.

If this function returns a number below 5500, the actual battery voltage might
be significantly lower than the value returned.  Since we are in a virtual
environment, we always return 0.  */
inline uint16_t readBatteryMillivolts()
{
    return 0;
}


/*! \brief Controls motor speed and direction on the Romi 32U4.
 *
 * This library uses Timer 1, so it will conflict with any other libraries using
 * that timer. */
class Romi32U4Motors
{
  public:
    /** \brief Flips the direction of the left motor.
     *
     * You can call this function with an argument of \c true if the left motor
     * of your Romi was not wired in the standard way and you want a
     * positive speed argument to correspond to forward movement.
     *
     * \param flip If true, then positive motor speeds will correspond to the
     * direction pin being high.  If false, then positive motor speeds will
     * correspond to the direction pin being low.
     */
    void flipLeftMotor(bool flip) {
        flipLeft = flip;
    }

    /** \brief Flips the direction of the right motor.
     *
     * You can call this function with an argument of \c true if the right motor
     * of your Romi was not wired in the standard way and you want a
     * positive speed argument to correspond to forward movement.
     *
     * \param flip If true, then positive motor speeds will correspond to the
     * direction pin being high.  If false, then positive motor speeds will
     * correspond to the direction pin being low. */
    void flipRightMotor(bool flip) {
        flipRight = flip;
    }

    /** \brief Sets the speed for the left motor.
     *
     * \param speed A number from -300 to 300 representing the speed and
     * direction of the left motor.  Values of -300 or less result in full speed
     * reverse, and values of 300 or more result in full speed forward. */
    void setLeftSpeed(int16_t speed) {
        // Flip directions
        if (flipLeft) speed = -speed;
        // Capping
        if (speed > maxSpeed) speed = maxSpeed;
        if (speed < -maxSpeed) speed = -maxSpeed;
        
        // Call the api
        cc_leftMotorSpeed(speed);
        delay(1); // always give the rest of the js code time to execute
    }

    /** \brief Sets the speed for the right motor.
     *
     * \param speed A number from -300 to 300 representing the speed and
     * direction of the right motor. Values of -300 or less result in full speed
     * reverse, and values of 300 or more result in full speed forward. */
    void setRightSpeed(int16_t speed) {
        // Flip directions
        if (flipRight) speed = -speed;
        // Capping
        if (speed > maxSpeed) speed = maxSpeed;
        if (speed < -maxSpeed) speed = -maxSpeed;
        // Call the api
        cc_rightMotorSpeed(speed);
        delay(1); // always give the rest of the js code time to execute
    }

    /** \brief Sets the speed for both motors.
     *
     * \param leftSpeed A number from -300 to 300 representing the speed and
     * direction of the right motor. Values of -300 or less result in full speed
     * reverse, and values of 300 or more result in full speed forward.
     * \param rightSpeed A number from -300 to 300 representing the speed and
     * direction of the right motor. Values of -300 or less result in full speed
     * reverse, and values of 300 or more result in full speed forward. */
    void setSpeeds(int16_t leftSpeed, int16_t rightSpeed) {
        setLeftSpeed(leftSpeed);
        setRightSpeed(rightSpeed);
    }

    /** \brief Turns turbo mode on or off.
     *
     * By default turbo mode is off.  When turbo mode is on, the range of speeds
     * accepted by the other functions in this library becomes -400 to 400
     * (instead of -300 to 300).  Turning turbo mode on allows the Romi to move
     * faster but could decrease the lifetime of the motors.
     *
     * This function does not have any immediate effect on the speed of the
     * motors; it just changes the behavior of the other functions in this
     * library.
     *
     * \param turbo If true, turns turbo mode on.
     *   If false, turns turbo mode off. */
    void allowTurbo(bool turbo) {
        if (turbo) {
            maxSpeed = 400;
        } else {
            maxSpeed = 300;
        }
    }

  private:
    int16_t maxSpeed = 300;
    bool flipLeft = false;
    bool flipRight = false;
};

class ButtonBase {
  public:
    void waitForRelease() {
        do {
          while (isPressed()); // wait for button to be released
          delay(10);           // debounce the button release
        } while (isPressed());   // if button isn't still released, loop
    }

    void waitForPress() {
        do {
            while (!isPressed()); // wait for button to be pressed
            delay(10);            // debounce the button press
        } while (!isPressed());   // if button isn't still pressed, loop
    }

    bool isPressed() {
        delay(1); // always give the rest of the js code time to execute
        return cc_buttonPressed(_btnNbr) == 1;
    }

    ButtonBase(int btnNbr) {
        // can you tell that i'm not a c++ programmer...
        _btnNbr = btnNbr;
    }

  private:
    int _btnNbr;
};

class Romi32U4ButtonA : public ButtonBase {
    public: Romi32U4ButtonA() : ButtonBase(0) {}
};

class Romi32U4ButtonB : public ButtonBase {
    public: Romi32U4ButtonB() : ButtonBase(1) {}
};

class Romi32U4ButtonC : public ButtonBase {
    public: Romi32U4ButtonC() : ButtonBase(2) {}
};


#define INPUT 0
#define OUTPUT 1
/** \brief Sets the pin mode.
 * Not needed for virtual environment.
 */
void pinMode(int pin, int mode) {
    (void)pin;
    (void)mode;
}

// binding code
#include <emscripten/bind.h>

void setup();
void loop();

// code to set up various variables
void glueSetupAndRun() {
    // call the setup() function of the user code
    setup();

    // call the loop() function of the user code
    while (1) {
        delay(1); // always give the rest of the js code time to execute
        loop();
    }
}

EMSCRIPTEN_BINDINGS(romi_code) {
    emscripten::function("GlueCode_setupAndRun", &glueSetupAndRun);
}
