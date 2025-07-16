import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import styles from "./UserEnrolledLearningObjects.module.css";
import { getALMConfig } from "../../utils/global";
import { QueryParams, RestAdapter } from "../../utils/restAdapter";
import { JsonApiParse } from "../../utils/jsonAPIAdapter";
import { JsonApiResponse, PrimeLearningObject } from "../../models";
import { AlertType } from "../../common/Alert/AlertDialog";
import { useAlert } from "../../common/Alert/useAlert";

// Helper function outside component to avoid recreation
function getCookieByName(name: string): string | null {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

const UserEnrolledLearningObjects = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [learningObjects, setLearningObjects] = useState<PrimeLearningObject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiCallInProgress, setApiCallInProgress] = useState<boolean>(false);
  const [availableCourses, setAvailableCourses] = useState<Set<string>>(new Set());
  const [almAlert] = useAlert();

  // Function to handle course button click
  const checkCourseAvailability = useCallback((courseId: string, event: React.MouseEvent) => {
    // If the course is already known to be available, just allow redirect to courseUrl without popup
    if (availableCourses.has(courseId)) {
      // Don't do anything - allow the default link navigation to happen
      return;
    }
    
    // Prevent the default link behavior for courses not yet verified
    event.preventDefault();
    
    // Just show the popup without making an API call
    almAlert(true, "CHECKING COURSE AVAILABILITY...", AlertType.success, true);
  }, [almAlert, availableCourses]);

  // Helper function to check availability of courses in batch
  const checkCoursesAvailability = useCallback(async (courseIds: string[]) => {
    try {
      // Get the OAuth token from cookies
      const almCpToken = getCookieByName("alm_cp_token");
      
      if (!almCpToken) {
        console.error("Authentication token not found");
        return;
      }
      
      // Create a new Set to store available course IDs
      const availableCoursesSet = new Set<string>();
      
      // Check each course availability
      await Promise.all(courseIds.map(async (courseId) => {
        try {
          const apiUrl = `https://learningmanager.adobe.com/primeapi/v2/learningObjects/${encodeURIComponent(courseId)}`;
          
          const response = await axios.get(apiUrl, {
            headers: {
              'Accept': 'application/vnd.api+json',
              'Authorization': `oauth ${almCpToken}`
            }
          });
          
          // If course is available, add to the set
          if (response.status === 200 && response.data.data.relationships.enrollment) {
            availableCoursesSet.add(courseId);
          }
        } catch (error) {
          console.error(`Error checking availability for course ${courseId}:`, error);
        }
      }));
      
      // Update state with all available courses
      setAvailableCourses(availableCoursesSet);
    } catch (error) {
      console.error("Error checking courses availability:", error);
    }
  }, []);

  useEffect(() => {
    const getEnrolledLearningObjects = async (id: string): Promise<JsonApiResponse | undefined> => {
      try {
        const baseApiUrl = getALMConfig().primeApiURL;
        const params: QueryParams = 
        {   userId: id,
            'filter.loTypes': 'course',
            'page[limit]': '100',
            //'filter.learnerState': 'enrolled',
            'sort': 'name',
            'filter.ignoreEnhancedLP': 'true'
         };

        const response = await RestAdapter.get({
          url: `${baseApiUrl}/learningObjects?`,
          params
        });
        return JsonApiParse(response);
      } catch (e) {
        setError(`Error loading learning objects: ${e}`);
        console.error("Error while loading learning objects:", e);
      }
    };

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const cookieValue = getCookieByName("user");

        if (!cookieValue) {
          setError("User data not found");
          setIsLoading(false);
          return;
        }

        const parsedJson = JSON.parse(cookieValue);

        if (parsedJson?.data?.id) {
          const userId = parsedJson.data.id;
          setUserId(userId);

          const response = await getEnrolledLearningObjects(userId);

          if (response?.learningObjectList) {
            const courses = response.learningObjectList;
            setLearningObjects(courses);
            
            // Check availability for all courses at once
            const courseIds = courses.map(course => course.id);
            checkCoursesAvailability(courseIds);
          } else {
            setLearningObjects([]);
          }
        } else {
          setError("User ID not found in the cookie data");
        }
      } catch (error) {
        setError(`Error processing data: ${error}`);
        console.error("Error in fetchData:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [checkCoursesAvailability]);

  // Memoize the course grid to prevent unnecessary re-renders
  const courseGrid = useMemo(() => {
    return learningObjects.map((course: PrimeLearningObject, index: number) => {
      if (!course.localizedMetadata || !course.localizedMetadata[0]) return null;

      const metadata = course.localizedMetadata[0];
      const ratingObj = course.rating;
      const averageRating = ratingObj?.averageRating || 0;
      const ratingsCount = ratingObj?.ratingsCount || 0;
      const tags = course.tags || [];
      const instanceId = course.instances && course.instances[0] ? course.instances[0].id : "";
      const courseUrl = `http://localhost:4503/content/learning/language-masters/en/overview.html/trainingId/${course.id}/trainingInstanceId/${instanceId}/home.html`;

      const fallbackImage = "https://fastly.picsum.photos/id/60/1920/1200.jpg?hmac=fAMNjl4E_sG_WNUjdU39Kald5QAHQMh-_-TsIbbeDNI";
      return (
        <div key={index} className={styles.courseTile}>
          <div className={styles.imageBanner}>
            <img
              src={course.imageUrl || fallbackImage}
              alt={metadata.name || "Course image"}
              className={styles.courseImage}
              onError={(e) => {
                e.currentTarget.src = fallbackImage;
              }}
            />
          </div>
          <div className={styles.courseInfo}>
            <h3 className={styles.courseTitle}>{metadata.name || "Untitled Course"}</h3>

            <div className={styles.courseTags}>
              <div className={styles.courseRating}>
                <span className={styles.ratingLabel}>Rating: </span>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                      key={star} 
                      className={`${styles.star} ${star <= averageRating ? styles.starFilled : styles.starEmpty}`}
                    >
                      {star <= averageRating ? '★' : '☆'}
                    </span>
                  ))}
                </div>    
                  <span className={styles.ratingsCount}>({ratingsCount})</span>
              </div>
              {tags && tags.length > 0 && (
                <div className={styles.tagsList}>
                  {tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.courseFooter}>
              <p className={styles.courseDescription}>
                {metadata.description ?
                  (metadata.description.length > 100 ?
                    `${metadata.description.substring(0, 100)}...` :
                    metadata.description) :
                  "No description available"}
              </p>
              <a
                href={courseUrl}
                className={availableCourses.has(course.id) ? styles.availableButton : styles.viewButton}
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => checkCourseAvailability(course.id, e)}
              >
                {availableCourses.has(course.id) ? 'Go to Available Course' : 'Check Availability'}
              </a>
            </div>
          </div>
        </div>
      );
    });
  }, [learningObjects, availableCourses, checkCourseAvailability]);

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionHeading}>Your Learings</h2>

      {isLoading && (
        <p className={styles.loadingMessage}>Loading your learning objects...</p>
      )}

      {error && (
        <p className={styles.errorMessage}>{error}</p>
      )}

      {!isLoading && !error && (
        <div>
          {learningObjects.length > 0 ? (
            <div className={styles.courseGrid}>
              {courseGrid}
            </div>
          ) : (
            <p className={styles.noCoursesMessage}>No enrolled courses found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserEnrolledLearningObjects;
