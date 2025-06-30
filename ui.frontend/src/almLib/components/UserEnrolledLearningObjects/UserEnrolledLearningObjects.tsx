import React, { useState, useEffect, useMemo } from "react";
import styles from "./UserEnrolledLearningObjects.module.css";
import { getALMConfig } from "../../utils/global";
import { QueryParams, RestAdapter } from "../../utils/restAdapter";
import { JsonApiParse } from "../../utils/jsonAPIAdapter";
import { JsonApiResponse, PrimeLearningObject, PrimeLearningObjectInstance } from "../../models";

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

  useEffect(() => {
    const getEnrolledLearningObjects = async (id: string): Promise<JsonApiResponse | undefined> => {
      try {
        const baseApiUrl = getALMConfig().primeApiURL;
        const params: QueryParams = { userId: id };

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
            setLearningObjects(response.learningObjectList);
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
  }, []);

  // Memoize the course grid to prevent unnecessary re-renders
  const courseGrid = useMemo(() => {
    return learningObjects.map((course: PrimeLearningObject, index: number) => {
      // Skip if no localized metadata is available
      if (!course.localizedMetadata || !course.localizedMetadata[0]) return null;
      
      const metadata = course.localizedMetadata[0];
      const instanceId = course.instances && course.instances[0] ? course.instances[0].id : "";
      const courseUrl = `http://localhost:4503/content/learning/language-masters/en/overview.html/trainingId/${course.id}/trainingInstanceId/${instanceId}/home.html`;
      
      const fallbackImage = "https://img.freepik.com/free-vector/online-certification-illustration_23-2148575636.jpg?semt=ais_hybrid&w=740";
      
      return (
        <div key={index} className={styles.courseTile}>
          <a href={courseUrl} className={styles.courseLink}>
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
              <p className={styles.courseDescription}>
                {metadata.description ? 
                  (metadata.description.length > 100 ? 
                    `${metadata.description.substring(0, 100)}...` : 
                    metadata.description) : 
                  "No description available"}
              </p>
            </div>
          </a>
        </div>
      );
    });
  }, [learningObjects]);

  // UI rendering based on component state
  return (
    <div className={styles.container}>
      <h2>My Enrolled Learning Objects</h2>
      
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