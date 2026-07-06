const prefix = '/api';
export const API_ENDPOINTS = {
  LOGIN: `${prefix}/user/v1/account/login`,
  ADMIN_LOGIN: `${prefix}/user/v1/admin/login`,
  GENERATE_RESET_OTP: `${prefix}/user/v1/account/generateOtp`,
  RESET_PASSWORD: `${prefix}/user/v1/account/resetPassword`,
  REFRESH_TOKEN: `${prefix}/user/v1/account/generateToken`,
  USER_PROFILE: `${prefix}/user/v1/user/read`,
  TARGETED_SOLUTIONS: `${prefix}/survey/v1/solutions/targetedSolutions`,
  OBSERVATION_ENTITIES: `${prefix}/survey/v1/observations/entities`,
  UPDATE_OBSERVATION_ENTITIES: `${prefix}/survey/v1/observations/updateEntities`,
  SEARCH_OBSERVATION_ENTITIES: `${prefix}/survey/v1/observations/searchEntities`,
  OBSERVATION_SOLUTION: `${prefix}/survey/v1/observations/assessment`,
  OBSERVATION_SUBMISSIONS: `${prefix}/survey/v1/observationSubmissions/list`,
  CREATE_OBSERVATION_SUBMISSION: `${prefix}/survey/v1/observationSubmissions/create`,
  // Used by syncService to push offline form edits back to the server.
  // Pattern: POST /api/survey/v1/observationSubmissions/update/{observationId}?entityId={entityId}
  UPDATE_OBSERVATION_SUBMISSION: `${prefix}/survey/v1/observationSubmissions/update`,
  PARTICIPANTS_LIST: `${prefix}/project/v1/programUsers/entities`,
  PARTICIPANTS_SUB_ENTITY_LIST: `${prefix}/entity-management/v1/entities/subEntityList`,
  ENTITY_DETAILS: `${prefix}/entity-management/v1/entities/details`,
  PROJECT_CATEGORIES_LIST: `${prefix}/project/v1/library/categories/list?parentId=null&keywords=idp&getChildren=true`,
  GET_ENTITY_DETAILS: (id: string) =>
    `${prefix}/entity-management/v1/entities/details/${id}`,
  UPDATE_ENTITY_DETAILS: `${prefix}/project/v1/programUsers/createOrUpdate`,
  USER_ROLES_LIST: `${prefix}/user/v1/user-role/list`,  // Fetch available user roles for dynamic filter
  ENTITY_TYPES_LIST: `${prefix}/entity-management/v1/entityTypes/list`,  // Fetch entity types (province, district, etc.)
  ENTITIES_BY_TYPE: `${prefix}/entity-management/v1/entities/listByEntityType`,  // Fetch entities by type (e.g., provinces)
  USERS_LIST: `${prefix}/user/v1/account/search`,  // Search users for user management
  DEACTIVATE_USER: `user/v1/admin/deactivateUser`,
  ORG_ADMIN_UPDATE_USER: `${prefix}/user/v1/org-admin/updateUser`,
  GET_SIGNED_URL: `${prefix}/user/v1/cloud-services/file/getSignedUrl`,
  BULK_USER_CREATE: `${prefix}/user/v1/tenant/bulkUserCreate`,
  PROGRAM_USERS_SEARCH: `${prefix}/project/v1/programUsers/search`, // Search program users (LCs, participants, etc.),
  UPDATE_ENTITY:`${prefix}/project/v1/programUsers/updateEntityProfile`,
  GENERATE_CERTIFICATE: (projectId: string) => `${prefix}/project/v1/userProjects/update/${projectId}`,
  PROJECT_DETAILS: (id: string) => `${prefix}/project/v1/userProjects/details/${id}`
};
