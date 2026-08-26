import { Inject } from '@nestjs/common';

/** DI token carrying the resolved alarms configuration. */
export const ALARMS_CONFIG = Symbol('ALARMS_CONFIG');

/** Parameter decorator injecting {@link ALARMS_CONFIG}. */
export const InjectAlarmsConfig = (): ParameterDecorator =>
    Inject(ALARMS_CONFIG);
