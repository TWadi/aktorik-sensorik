// Temperature sensors: platinum resistance thermometer (PT100), NTC thermistor, thermocouple.
// Pure functions. Temperatures are in °C unless the name says kelvin; resistances in Ω,
// voltages in V, currents in A.

/** 0 °C in kelvin. */
export const KELVIN_OFFSET = 273.15;

/** Platinum sensor: 100 Ω at 0 °C, linear coefficient α per °C. */
export const PT100 = Object.freeze({ R0: 100, alpha: 3.851e-3 });

/** Typical NTC thermistor: 10 kΩ at 25 °C, material constant B in kelvin. */
export const NTC_10K = Object.freeze({ R25: 10e3, B: 3950, T25: 25 });

/** Seebeck coefficient of a type K (NiCr-Ni) thermocouple in V/K, taken as constant. */
export const SEEBECK_K = 41e-6;

/** °C -> K. */
export const toKelvin = (T) => T + KELVIN_OFFSET;

// ---------------------------------------------------------------- platinum resistance thermometer

/** Linear model R(T) = R0·(1 + α·T), T in °C. */
export const ptResistance = (T, pt = PT100) => pt.R0 * (1 + pt.alpha * T);

/** Inverse of the linear model: temperature in °C from a measured resistance. */
export const ptTemperature = (R, pt = PT100) => (R / pt.R0 - 1) / pt.alpha;

/** Sensitivity dR/dT in Ω/K (constant in the linear model). */
export const ptSensitivity = (pt = PT100) => pt.R0 * pt.alpha;

/** Relative sensitivity (dR/dT)/R in 1/K at temperature T. */
export const ptRelSensitivity = (T, pt = PT100) => pt.alpha / (1 + pt.alpha * T);

/** Voltage across a sensor with resistance R fed by the constant current I. */
export const sensorVoltage = (R, I) => R * I;

/** Power that the measuring current turns into heat inside the sensor: P = I²·R. */
export const selfHeatingPower = (R, I) => I * I * R;

/** Temperature error in K that an unnoticed lead resistance causes in a two-wire connection. */
export const leadError = (Rlead, pt = PT100) => Rlead / ptSensitivity(pt);

// ---------------------------------------------------------------- NTC thermistor

/** B-parameter model R(T) = R25·exp(B·(1/T − 1/T25)) with both temperatures in kelvin. T in °C. */
export const ntcResistance = (T, ntc = NTC_10K) => ntc.R25 * Math.exp(ntc.B * (1 / toKelvin(T) - 1 / toKelvin(ntc.T25)));

/** Relative sensitivity (dR/dT)/R = −B/T² in 1/K (T in kelvin inside the formula). T in °C. */
export const ntcRelSensitivity = (T, ntc = NTC_10K) => -ntc.B / toKelvin(T) ** 2;

/** Sensitivity dR/dT in Ω/K at temperature T (°C). */
export const ntcSensitivity = (T, ntc = NTC_10K) => ntcResistance(T, ntc) * ntcRelSensitivity(T, ntc);

/** Inverse of the B-parameter model (the "linearisation" a microcontroller performs). Returns °C. */
export const ntcTemperature = (R, ntc = NTC_10K) => 1 / (1 / toKelvin(ntc.T25) + Math.log(R / ntc.R25) / ntc.B) - KELVIN_OFFSET;

// ---------------------------------------------------------------- thermocouple

/** Thermoelectric voltage U_th = α_AB·(T_M − T_V): measuring junction minus reference junction. */
export const thermoVoltage = (Tm, Tv, alpha = SEEBECK_K) => alpha * (Tm - Tv);

/**
 * Temperature an instrument displays for the voltage U.
 * Without compensation it only knows the difference U/α; with compensation it adds T_V.
 */
export const thermoReading = (U, Tv, compensate, alpha = SEEBECK_K) => U / alpha + (compensate ? Tv : 0);
