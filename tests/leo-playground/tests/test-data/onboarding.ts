import { SHEPHERDS_PROD, ShepherdsCount_prod } from "./onboarding-prod";
import { SHEPHERDS_STAGE, ShepherdsCount_stage } from "./onboarding-stage";

const ENV = process.env.TEST_MODE ?? 'staging';

export const shepherds =
  ENV === 'production' ? SHEPHERDS_PROD  : SHEPHERDS_STAGE;  

export const shepherdsCount = 
  ENV === 'production' ? ShepherdsCount_prod : ShepherdsCount_stage;
  