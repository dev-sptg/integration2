import { SHEPHERDS_BASE } from "./onboarding-base";
import { Assistant_base, Project_base, NewProject_base, DownloadProject_base, Examples_base,
         Docs_base, Report_base, StdIn_base, ProjectName_base, Shield_base } from "./onboarding-base";

export const SHEPHERDS_PROD = {
    ...SHEPHERDS_BASE,
    '10': Project_base,
    '11': NewProject_base,
    '12': DownloadProject_base,
    '13': Examples_base,
    '14': Docs_base,
    '15': Report_base,
    '16': StdIn_base,
    '17': ProjectName_base,
    '18': Shield_base, 
}

export const ShepherdsCount_prod = 18;