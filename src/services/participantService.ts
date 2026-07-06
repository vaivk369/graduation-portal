import type { ParticipantSearchParams, ParticipantSearchResponse, Site } from '@app-types/participant';
import { PARTICIPANTS_DATA, PROVINCES, SITES } from '@constants/PARTICIPANTS_LIST';
import api, { OBSERVATION_RETRY_CONFIG, withRetry } from './api';
import { API_ENDPOINTS } from './apiEndpoints';
import { ROLE_NAMES } from '@constants/ROLES';
import { getUserProfile } from './authenticationService';
import { User } from '@contexts/AuthContext';
import { getObservationEntities } from './solutionService';
import { CERTIFICATE_KEYWORD, ENDLINE_KEYWORD } from '@constants/LOG_VISIT_CARDS';
import logger from '@utils/logger';
import { STATUS, ENTITY_STATUS, PROJECT_STATUS, GRADUATION_READINESS_PROGRESS_THRESHOLD } from '@constants/app.constant';
import { isNetworkOffline } from '@utils/networkStatus';
import offlineStorage, { getOfflineParticipantIds } from './offlineStorage';
import { PARTICIPANT_KEYS } from '@constants/STORAGE_KEYS';

/**
 * Get participants list for table view
 * Searches users by user IDs and returns the search response
 *
 * @param params - Search parameters including user_ids array and optional query params
 * @returns A promise resolving to the search response from the API
 */
export const getParticipantsList = async (params: ParticipantSearchParams): Promise<ParticipantSearchResponse> => {
  // Prevent API call when offline — serve from cached storage instead.
  if (isNetworkOffline()) {
    if (params.entityId) {
      // Single-participant lookup: return details or list-snapshot from cache
      const details = await offlineStorage.read<any>(PARTICIPANT_KEYS.details(params.entityId)).catch(() => null);
      const snapshot = await offlineStorage.read<any>(PARTICIPANT_KEYS.listSnapshot(params.entityId)).catch(() => null);
      const row = details ?? snapshot ?? null;
      return { result: { data: row ? [row] : [], count: row ? 1 : 0 } } as unknown as ParticipantSearchResponse;
    }
    // Full list: read all downloaded snapshots
    const ids = await getOfflineParticipantIds().catch(() => [] as string[]);
    const snapshots = await Promise.all(
      ids.map(id => offlineStorage.read<any>(PARTICIPANT_KEYS.listSnapshot(id)).catch(() => null)),
    );
    const participants = snapshots.filter(Boolean);
    return { result: { data: participants, count: participants.length } } as unknown as ParticipantSearchResponse;
  }

  try {
    const {
      userId,
      type = ROLE_NAMES.USER,
      page = 1,
      limit = 20,
      search,
      status,
      entityId,
    } = params;


    // Build query string
    const queryParams = new URLSearchParams({
      userId,
      type,
      page: page.toString(),
      limit: limit.toString(),
      search: search || '',
      programId: process.env.GLOBAL_LC_PROGRAM_ID as string,
      ...(entityId ? {entityId}:{})
    });

    // Add status to query params if provided
    if (status) {
      queryParams.append('status', status);
    }


    const endpoint = `${API_ENDPOINTS.PARTICIPANTS_LIST}?${queryParams.toString()}`;
    
    // Validate entity_id before constructing endpoint
    // if (!entity_id?.trim()) {
    //   throw new Error('entity_id is required and cannot be empty');
    // }
    
    // const subEntityListEndpoint = `${API_ENDPOINTS.PARTICIPANTS_SUB_ENTITY_LIST}/${encodeURIComponent(entity_id)}?type=${ROLE_NAMES.PARTICIPANT.toLowerCase()}`;
    // const subEntityListResponse = await api.get<any>(subEntityListEndpoint);
    // const subEntityList = subEntityListResponse.data?.result?.data || [];

    const response = await api.get<ParticipantSearchResponse>(
      endpoint,
      entityId ? withRetry(OBSERVATION_RETRY_CONFIG) : undefined,
    );
    return response.data;
  } catch (error: any) {
    // Error is already handled by axios interceptor
    throw error;
  }
};

export const getParticipantById = (id: string): any => {
  const participant = PARTICIPANTS_DATA.find(p => p.id === id);
  if (!participant) return undefined;
  return {
    id: participant.id,
    name: participant.name,
    contact: participant.contact,
    status: participant.status,
    progress: participant.progress,
    pathway: participant.pathway || undefined,
    graduationProgress:
      participant.graduationProgress != null &&
      !isNaN(Number(participant.graduationProgress))
        ? participant.graduationProgress
        : undefined,
    graduationDate:
      participant.graduationDate && participant.graduationDate !== ''
        ? participant.graduationDate
        : undefined,
    email: participant.email,
    address: participant.address,
  };
};
/**
 * Get participant profile data by ID
 * Returns full participant data including contact info and address
 * Currently uses mock data, will be replaced with API call later
 */
export const getParticipantProfile = async (id: string): Promise<User |undefined> => {
  try {
    const userProfile = await getUserProfile(id);

    return userProfile;
  } catch (error: any) {
    // Error is already handled by axios interceptor
    throw error;
  }
};

/**
 * Update participant address
 * Currently uses mock data update, will be replaced with API call later
 * 
 * @param id - Participant ID
 * @param address - New address object with street, province, and site
 * @returns Updated participant or undefined if not found
 */

interface UpdateParticipantAddressPayload {
  // userId: string;
  entityId: string;
  programId:string;
  updateData: {
    // province: string;
    // site: string;
    location: string;
  };
}

export const updateParticipantAddress = async (
  payload: UpdateParticipantAddressPayload
): Promise<any> => {
  try {
    const response = await api.post(API_ENDPOINTS.UPDATE_ENTITY, payload);
    return response?.data;
  } catch (error) {
    console.error('updateParticipantAddress error:', error);
    throw error;
  }
};
/**
 * Get province label by value
 * @param value - Province value
 * @returns Province label or the value if not found
 */
export const getProvinceLabel = (value: string): string => {
  const province = PROVINCES.find(p => p.value === value);
  return province?.label || value;
};

/**
 * Get site label by value
 * @param value - Site value
 * @returns Site label or the value if not found
 */
export const getSiteLabel = (value: string): string => {
  const site = SITES.find(s => s.value === value);
  return site?.label || value;
};

/**
 * Get sites by province (for future API integration)
 * For now, returns all sites. In future, this will filter by province
 * @param provinceValue - Province value to filter sites
 * @returns Array of sites for the given province
 */
export const getSitesByProvince = (provinceValue: string): Site[] => {
  // TODO: Replace with API call that filters sites by province
  // For now, return all sites
  return SITES;
};

export const getEntityDetails = async (userId: string): Promise<any> => {
  // Prevent API call when offline — return cached entity details.
  if (isNetworkOffline()) {
    const details = await offlineStorage.read<any>(PARTICIPANT_KEYS.details(userId)).catch(() => null);
    const snapshot = await offlineStorage.read<any>(PARTICIPANT_KEYS.listSnapshot(userId)).catch(() => null);
    return { data: details ?? snapshot ?? null };
  }

  try {
    const response = await api.get(API_ENDPOINTS.GET_ENTITY_DETAILS(userId));
    return { data: response.data.result };
  } catch (error) {
    throw error;
  }
};

export const updateEntityDetails = async ({
  userId,
  entityId,
  entityUpdates,
}: {
  userId:string;
  entityId: string;
  entityUpdates: any;
}): Promise<any> => {
  try {

    const requestBody = {
      userId,
      programId: process.env.GLOBAL_LC_PROGRAM_ID as string,
      entityId,
      entityUpdates,
    };

    const response = await api.post(
      API_ENDPOINTS.UPDATE_ENTITY_DETAILS,
      requestBody,
    );

    return { data: response.data.result };
  } catch (error) {
    throw error;
  }
};

export const createOrUpdateProgramUserMapping = async ({
  userId,
  programId,
  metaInformation,
  status
}: {
  userId: string;
  programId: string;
  metaInformation: any;
  status: string;
}): Promise<any> => {
  try {
    const requestBody = {
      userId,
      programId,
      metaInformation,
      status
    };

    const response = await api.post(
      API_ENDPOINTS.UPDATE_ENTITY_DETAILS,
      requestBody,
    );

    return { data: response.data.result };
  } catch (error) {
    throw error;
  }
};

/**
 * Generate certificate for participant (Mock API)
 * @param projectId - Project ID
 * @returns Certificate generation response
 */
export const generateCertificate = async (projectId: string): Promise<any> => {
  try {  
    const response = await api.post(API_ENDPOINTS.GENERATE_CERTIFICATE(projectId), {
      status: PROJECT_STATUS.SUBMITTED,
    });
    
    return response.data; 
  } catch (error) {
    throw error
  }
};

/**
 * Check targeted solution submission status by keyword
 * @param solutionData - Solution data with entity information
 * @param keyword - Keyword to match (case-insensitive)
 * @returns true if solution matches keyword and is completed
 */
const checkSolutionByKeyword = (solutionData: any, keyword: string): boolean => {
  // Check if solution has matching keyword (case-insensitive)
  const solutionKeywords = solutionData?.keywords || [];
  const hasKeyword = solutionKeywords.some(
    (k: string) => k.toLowerCase() === keyword.toLowerCase()
  );
  if (!hasKeyword) return false;
  
  return true;
};

export interface ParticipantCompletionActionResult {
  success: boolean;
  type: 'certificate' | 'endline' | '';
  error?: any;
}

/**
 * Verify participant completion conditions and perform required actions
 * This function handles certificate generation and participant graduation status updates
 * 
 * @param params - Object containing participant data and user ID
 * @param params.participantData - Participant data object
 * @param params.userId - User ID performing the action
 * @returns Promise<void>
 * 
 * @description
 * This function runs when participant status is COMPLETED or certificate already exists.
 * It performs the following actions:
 * 1. Fetches targeted solutions filtered by certificate and ENDLINE keywords
 * 2. Checks if certificate solution submission is completed
 *    - If completed and certificate not generated: calls certificate generation API
 *    - If certificate already exists: skips generation
 * 3. Checks if ENDLINE solution submission is completed
 *    - If completed: updates participant status to GRADUATED
 */
export const verifyParticipantCompletionActions = async ({
  participantData,
  userId,
  solutions
}: {
  participantData: any;
  userId: string;
  solutions: any[];
}): Promise<ParticipantCompletionActionResult> => {
  try {
    const completionPercentage = participantData?.idpProgress?.completionPercentage;
    const participantId = participantData?.id;
    const entityId = participantData?.entityId;
    const idpProjectId = participantData?.idpProjectId;
    const projectStatus = participantData?.idpProgress.projectStatus;
    // Check if conditions are met: status is COMPLETED or certificate already exists
    if (completionPercentage < GRADUATION_READINESS_PROGRESS_THRESHOLD) {
      logger.info('Participant completion actions skipped - conditions not met');
      return { success: false, type: '' };
    }

    if (!solutions || solutions.length === 0) {
      logger.warn('No targeted solutions found for certificate/ENDLINE keywords', {
        participantId,
      });
      return { success: false, type: '' };
    }
    
    // 2. Get entity details for each solution to check completion status
    const solutionsWithEntityStatus = await getSolutionWithEntityStatus(solutions, participantId);
    // 3. Process certificate solution
    const certificateSolution = solutionsWithEntityStatus.find((solution) =>
      checkSolutionByKeyword(solution, CERTIFICATE_KEYWORD)
    );
    if (certificateSolution) {
      const isCertificateCompleted = certificateSolution.entity?.status === ENTITY_STATUS.COMPLETED;
      if (isCertificateCompleted && projectStatus === PROJECT_STATUS.COMPLETED) {
        try {
          const certificateResult = await generateCertificate(idpProjectId);
          logger.info('Certificate generated successfully', {
            participantId,
            certificateResult,
          });
          return { success: true, type: 'certificate' };
        } catch (error) {
          logger.error('Failed to generate certificate', {
            participantId,
            error,
          });
        }
      }
    }

    // 4. Process ENDLINE solution
    const endlineSolution = solutionsWithEntityStatus.find((solution) =>
      checkSolutionByKeyword(solution, ENDLINE_KEYWORD)
    );

    if (endlineSolution) {
      const isEndlineCompleted = endlineSolution.entity?.status === ENTITY_STATUS.COMPLETED;

      if (isEndlineCompleted) {
        try {
          const thisDate = new Date().toISOString();
          await updateEntityDetails({
            userId,
            entityId,
            entityUpdates: {
              status: STATUS.COMPLETED,
              completedAt: thisDate,
            },
          });
          await createOrUpdateProgramUserMapping({
            userId: participantId,
            // @ts-ignore
            programId: process.env.GLOBAL_LC_PROGRAM_ID as string,
            metaInformation: {
              completedAt: thisDate,
            },
            status: STATUS.COMPLETED,
          });
          logger.info('Participant status updated to GRADUATED successfully', {
            participantId,
          });
          return { success: true, type: 'endline' };
        } catch (error) {
          logger.error('Failed to update participant status to GRADUATED', {
            participantId,
            error,
          });
          return { success: false, type: '', error: error as Error };
        }
      } else {
        logger.info('ENDLINE solution not yet completed', {
          participantId,
          entityStatus: endlineSolution.entity?.status,
        });
      }
    } else {
      logger.warn('ENDLINE solution not found in targeted solutions', {
        participantId,
      });
    }

    logger.info('Participant completion verification completed', {
      participantId,
    });
    return { success: false, type: '' };
  } catch (error) {
    logger.error('Error in verifyParticipantCompletionActions', {
      participantId: participantData?.id,
      error,
    });
    // Don't throw error - this is a background process that shouldn't block main flow
    return { success: false, type: '' };
  }
};

export const getSolutionWithEntityStatus = async (solutions: any[], participantId: string) => {
  return Promise.all(
    solutions.map(async (solution) => {
      try {
        const entityResponse = await getObservationEntities({
          solutionId: solution.solutionId,
          profileData: {},
        });
        // Find the participant entity from the response
        const participantEntity = entityResponse.result?.entities?.find(
          (entity: any) => `${entity.externalId}` === `${participantId}`
        );

        return {
          ...solution,
          entity: participantEntity || null,
        };
      } catch (error) {
        logger.error('Failed to fetch entity for solution', {
          solutionId: solution.solutionId,
          error,
        });
        return {
          ...solution,
          entity: null,
        };
      }
    })
  );
}

export const getProjectDetails = async (projectId: string): Promise<any> => {
  try {
    const response = await api.post(API_ENDPOINTS.PROJECT_DETAILS(projectId));
    return response.data.result;
  } catch (error) {
    logger.error('Failed to fetch project details', { projectId, error });
    throw error;
  }
}