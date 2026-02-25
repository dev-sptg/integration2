import { SHEPHERDS_BASE } from "./onboarding-base";
import { Assistant_base, Project_base, NewProject_base, DownloadProject_base, Examples_base,
         Docs_base, Report_base, StdIn_base, ProjectName_base, Shield_base } from "./onboarding-base";

export const SHEPHERDS_STAGE = {
    ...SHEPHERDS_BASE,
    '10': Assistant_base,
    '11': Project_base,
    '12': NewProject_base,
    '13': DownloadProject_base,
    '14': Examples_base,
    '15': Docs_base,
    '16': Report_base,
    '17': StdIn_base,
    '18': ProjectName_base,
    '19': Shield_base, 
}

export const ShepherdsCount_stage = 19;