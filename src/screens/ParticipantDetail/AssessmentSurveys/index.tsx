import React, { useEffect, useState, memo } from 'react';
import { VStack, Box, ScrollView, Text, Spinner } from '@ui';
import { useLanguage } from '@contexts/LanguageContext';
import { assessmentSurveysStyles } from './Styles';
import { AssessmentCard } from '@components/ObservationCards';
import type {
  AssessmentSurveyCardData,
  ParticipantData,
} from '@app-types/participant';
import type { OfflineSolutionEntry, ObservationFormData } from '@app-types/offline';
import { getObservationEntities, getTargetedSolutions } from '../../../services/solutionService';
import { FILTER_KEYWORDS } from '@constants/LOG_VISIT_CARDS';
import logger from '@utils/logger';
import { isWeb } from '@utils/platform';
import dataService from '../../../services/dataService';
import offlineStorage from '../../../services/offlineStorage';
import { PARTICIPANT_KEYS } from '@constants/STORAGE_KEYS';
import { ENTITY_TYPE } from '@constants/ROLES';
import { ENTITY_STATUS, GRADUATION_READINESS_PROGRESS_THRESHOLD, STATUS, USER_STATUS } from '@constants/app.constant';
import { sortByNestedOrder } from '@utils/helper';
import { solutionNamesOrder } from '@constants/app.constant';
import { getProjectDetails } from '../../../services/participantService';

interface AssessmentSurveysProps {
  participant: ParticipantData;
  completionPercentage: number;
  isReadOnly?:boolean;
}

const readOnlyAccessStatuses = [STATUS.COMPLETED, STATUS.GRADUATED, STATUS.DROPOUT, STATUS.NOT_ELIGIBLE];

/**
 * AssessmentSurveys Component
 * Displays assessment survey cards based on participant status
 */
const AssessmentSurveys: React.FC<AssessmentSurveysProps> = ({
  participant,
  completionPercentage = 0,
  isReadOnly
}) => {
  const { t } = useLanguage();
  const [solutions, setSolutions] = useState<AssessmentSurveyCardData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    const fetchSolutions = async () => {
      setLoading(true);
      try {
        const isOffline = dataService.isNetworkOffline();
        const participantUserId = participant?.userId || '';

        // ── OFFLINE PATH ──────────────────────────────────────────────────────
        // Load from the per-participant solutions mapping written during download.
        // No API calls are made offline.
        if (isOffline) {
          const storedEntries = await getTargetedSolutions({
            type: 'observation',
            // @ts-ignore
            'filter[keywords]': (readOnlyAccessStatuses.includes(participant?.status) || (participant?.status === STATUS.IN_PROGRESS && completionPercentage >= GRADUATION_READINESS_PROGRESS_THRESHOLD)) ? FILTER_KEYWORDS.PROGRAM_COMPLETED.join(',') : FILTER_KEYWORDS.ASSESSMENT_SURVEYS.join(','),
            participantId:participantUserId
          });
          if (!storedEntries?.length) {
            setSolutions([]);
            return;
          }
          const cards = await Promise.all(
            storedEntries.map(async (entry) => {
              const formData = await offlineStorage.read<ObservationFormData>(
                PARTICIPANT_KEYS.form(participantUserId, entry.solutionId),
              );
              if (!formData) return null;
              return {
                id: entry.observationId,
                solutionId: entry.solutionId,
                name: formData.schema?.solution?.name || entry.keyword,
                description: formData.schema?.solution?.description || '',
                navigationUrl: 'observation',
                keywords: [entry.keyword],
                entity: {
                  _id: formData.entityId,
                  status: formData.status || ENTITY_STATUS.STARTED,
                  submissionsCount: 1,
                  allowMultipleAssessemts: false,
                },
              } as AssessmentSurveyCardData;
            }),
          );
          setSolutions(cards.filter((c): c is AssessmentSurveyCardData => c !== null));
          return;
        }

        const onBoardingData = await getProjectDetails(participant?.onBoardedProjectId || '');
        let onBoardingSolutionDetails;
        if (onBoardingData) {
          const HHTask = onBoardingData.tasks.find((task: any) => task.externalId === "ONBOARD_2");
           // console.log('entity', entity);
          if (HHTask.status === "completed") {
            onBoardingSolutionDetails = HHTask.solutionDetails;
            onBoardingSolutionDetails['id'] = 'household-profile';
            onBoardingSolutionDetails['name'] = onBoardingSolutionDetails.name;
            onBoardingSolutionDetails['status'] = HHTask.status;
            onBoardingSolutionDetails['solutionId'] = String(onBoardingSolutionDetails._id);
            onBoardingSolutionDetails['navigationUrl'] = 'observation';
            onBoardingSolutionDetails['entity'] = {
                _id: participant?.id,
                status: 'completed'
              };
          }
        }

        // ── ONLINE PATH ───────────────────────────────────────────────────────
        const data = await getTargetedSolutions({
          type: 'observation',
          // @ts-ignore
          'filter[keywords]': (readOnlyAccessStatuses.includes(participant?.status) || (participant?.status === STATUS.IN_PROGRESS && completionPercentage >= GRADUATION_READINESS_PROGRESS_THRESHOLD)) ? FILTER_KEYWORDS.PROGRAM_COMPLETED.join(',') : FILTER_KEYWORDS.ASSESSMENT_SURVEYS.join(','),
          showReferenceFrom:true
        });

        let dataNew = await Promise.all(
          data.filter(item => !item.project).map(async (item) => {
            try {
              const entity = await getdetails({
                solutionId: item.solutionId,
                id: participant?.id,
              });

              if(participant?.accountUserStatus === USER_STATUS.INACTIVE || participant?.status === STATUS.DROPOUT || participant?.status === STATUS.NOT_ELIGIBLE || isReadOnly) {
                if(!entity?.allowMultipleAssessemts && entity?.status !== ENTITY_STATUS.COMPLETED) {
                    return null;
                }
              }
              return { ...item, entity:{...entity, status: entity?.status || ENTITY_STATUS.STARTED, submissionsCount: entity?.submissionsCount || 1 } };
            } catch (error) {
              logger.error('Failed to fetch entity for solutionId:', item.solutionId, error);
              return null;
            }
          })
        );
        dataNew.push(onBoardingSolutionDetails);
        const sortedData = sortByNestedOrder(dataNew, 'name', solutionNamesOrder);
        setSolutions(sortedData.filter((item): item is AssessmentSurveyCardData => item !== null));
      } catch (error) {
        logger.error('Error fetching solutions:', error);
        setSolutions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSolutions();
  }, [participant?.id, participant?.onBoardedProjectId, participant?.status, participant?.accountUserStatus, participant?.idpProgress?.completionPercentage]);

  const getdetails = async ({solutionId,id}:{solutionId:string,id:string}) => {
    const observationData = await getObservationEntities({
      solutionId,
      profileData: {},
    });
    if (
      observationData.result?.entityType === ENTITY_TYPE.PARTICIPANT &&
      Array.isArray(observationData.result?.entities)
    ) {
      const {entities, allowMultipleAssessemts} = observationData.result || {};
      const newData = entities.find(
        (entity: any) => entity.externalId == id,
      );
      if (newData) {
        return {...newData, allowMultipleAssessemts};
      }
    }
    return {};
  };
  if (loading) {
    return <Spinner height={isWeb ? ('$calc(100vh - 68px)' as any) : '$full'} size="large" color="$primary500" />;
  }
  
  return (
    <ScrollView
      {...assessmentSurveysStyles.scrollView}
      showsVerticalScrollIndicator={false}
    >
      <VStack {...assessmentSurveysStyles.cardsContainer} gap="$5" mt="$1">
        {solutions.length > 0 ? (
          solutions?.map(card => (
            <AssessmentCard
              key={card.solutionId || card.id}
              card={card}
              userId={participant?.userId || ''}
              participantId={participant?.id || ''}
              participantStatus={participant?.status}
              participantAccountUserStatus={participant?.accountUserStatus}
              isReadOnly={isReadOnly}
            />
          ))
        ) : (
          <Box {...assessmentSurveysStyles.container}>
            <VStack {...assessmentSurveysStyles.content}>
              {/* <Box {...assessmentSurveysStyles.emptyIconContainer}>
                You can add an icon here if needed
              </Box> */}
                <Text {...assessmentSurveysStyles.emptyTitle}>
                  {t('participantDetail.assessmentSurveys.noSurveysTitle')}
                </Text>
                <Text {...assessmentSurveysStyles.emptyDescription}>
                  {t(
                    'participantDetail.assessmentSurveys.noSurveysDescription',
                  )}
                </Text>
              </VStack>
          </Box>
        )}
      </VStack>
    </ScrollView>
  );
};

export default memo(AssessmentSurveys);
