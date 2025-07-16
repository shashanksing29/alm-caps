import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRef } from "react";
import axios from "axios";
import styles from "./UserEnrolledLearningObjects.module.css";
import { getALMConfig } from "../../utils/global";
import { QueryParams, RestAdapter } from "../../utils/restAdapter";
import { JsonApiParse } from "../../utils/jsonAPIAdapter";
import { JsonApiResponse, PrimeLearningObject } from "../../models";

// Type definitions
type ViewMode = "card" | "list";
type FilterType = "all" | "enrolled" | "not-enrolled";

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
  const [availableCourses, setAvailableCourses] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // No need for checkCourseAvailability function anymore as we're disabling unavailable courses

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

  // Debug effect to track filter changes
  useEffect(() => {
    console.log("Active filter changed to:", activeFilter);
  }, [activeFilter]);

  // Filter courses based on the active filter
  const filteredCourses = useMemo(() => {
    console.log("Computing filtered courses with filter:", activeFilter);
    console.log("Total courses:", learningObjects.length);
    console.log("Available courses:", availableCourses.size);
    
    let result;
    if (activeFilter === "all") {
      result = learningObjects;
    } else if (activeFilter === "enrolled") {
      result = learningObjects.filter(course => availableCourses.has(course.id));
    } else {
      result = learningObjects.filter(course => !availableCourses.has(course.id));
    }
    
    console.log("Filtered courses count:", result.length);
    return result;
  }, [learningObjects, availableCourses, activeFilter]);

  // Memoize the course grid to prevent unnecessary re-renders
  const courseGrid = useMemo(() => {
    console.log("Rendering course grid with", filteredCourses.length, "courses");
    return filteredCourses.map((course: PrimeLearningObject, index: number) => {
      if (!course.localizedMetadata || !course.localizedMetadata[0]) return null;

      const metadata = course.localizedMetadata[0];
      const ratingObj = course.rating;
      const averageRating = ratingObj?.averageRating || 0;
      const ratingsCount = ratingObj?.ratingsCount || 0;
      const tags = course.tags || [];
      const instanceId = course.instances && course.instances[0] ? course.instances[0].id : "";
      const courseUrl = `http://localhost:4503/content/learning/language-masters/en/overview.html/trainingId/${course.id}/trainingInstanceId/${instanceId}/home.html`;

      const fallbackImage = "https://fastly.picsum.photos/id/60/1920/1200.jpg?hmac=fAMNjl4E_sG_WNUjdU39Kald5QAHQMh-_-TsIbbeDNI";
      
      // Card view rendering
      if (viewMode === "card") {
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
                  <span className={styles.ratingLabel}>Course Rating: </span>
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
                {availableCourses.has(course.id) ? (
                  <a
                    href={courseUrl}
                    className={styles.availableButton}
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View Course
                  </a>
                ) : (
                  <span className={styles.disabledButton}>
                    Not Enrolled
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      } 
      // List view rendering
      else {
        return (
          <div key={index} className={styles.courseListItem}>
            <div className={styles.listItemImage}>
              <img
                src={course.imageUrl || fallbackImage}
                alt={metadata.name || "Course image"}
                className={styles.courseImage}
                onError={(e) => {
                  e.currentTarget.src = fallbackImage;
                }}
              />
            </div>
            <div className={styles.listItemContent}>
              <div className={styles.listItemHeader}>
                <h3 className={styles.courseTitle}>{metadata.name || "Untitled Course"}</h3>
                <div className={styles.courseRating}>
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
              </div>
              
              {tags && tags.length > 0 && (
                <div className={styles.tagsList}>
                  {tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
              
              <p className={styles.courseDescription}>
                {metadata.description ?
                  (metadata.description.length > 150 ?
                    `${metadata.description.substring(0, 150)}...` :
                    metadata.description) :
                  "No description available"}
              </p>
              
              <div className={styles.listItemFooter}>
                {availableCourses.has(course.id) ? (
                  <a
                    href={courseUrl}
                    className={styles.availableButton}
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View Course
                  </a>
                ) : (
                  <span className={styles.disabledButton}>
                    Not Enrolled
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
    });
  }, [learningObjects, availableCourses, viewMode]);

  // Count courses by enrollment status
  const enrolledCount = useMemo(() => {
    return learningObjects.filter(course => availableCourses.has(course.id)).length;
  }, [learningObjects, availableCourses]);

  const notEnrolledCount = useMemo(() => {
    return learningObjects.length - enrolledCount;
  }, [learningObjects, enrolledCount]);

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.sectionHeading}>Your Learning Dashboard</h2>
        
        {!isLoading && !error && learningObjects.length > 0 && (
          <div className={styles.viewToggleContainer}>
            <button 
              className={`${styles.viewToggleButton} ${viewMode === "card" ? styles.activeView : ""}`}
              onClick={() => setViewMode("card")}
              aria-label="Card View"
              title="Card View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button 
              className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.activeView : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="List View"
              title="List View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <p className={styles.loadingMessage}>Loading your courses...</p>
      )}

      {error && (
        <p className={styles.errorMessage}>{error}</p>
      )}

      {!isLoading && !error && (
        <div className={styles.contentContainer}>
          {/* Filter Panel */}
          <div className={styles.filterPanel}>
            <h3 className={styles.filterHeading}>Filter Courses</h3>
            <ul className={styles.filterList}>
              <li>
                <button 
                  className={`${styles.filterButton} ${activeFilter === "all" ? styles.activeFilter : ""}`}
                  onClick={() => {
                    console.log("Filter clicked: All Courses");
                    setActiveFilter("all");
                  }}
                  type="button"
                >
                  All Courses
                  <span className={styles.filterCount}>{learningObjects.length}</span>
                </button>
              </li>
              <li>
                <button 
                  className={`${styles.filterButton} ${activeFilter === "enrolled" ? styles.activeFilter : ""}`}
                  onClick={() => {
                    console.log("Filter clicked: Enrolled");
                    setActiveFilter("enrolled");
                  }}
                  type="button"
                >
                  Enrolled
                  <span className={styles.filterCount}>{enrolledCount}</span>
                </button>
              </li>
              <li>
                <button 
                  className={`${styles.filterButton} ${activeFilter === "not-enrolled" ? styles.activeFilter : ""}`}
                  onClick={() => {
                    console.log("Filter clicked: Not Enrolled");
                    setActiveFilter("not-enrolled");
                  }}
                  type="button"
                >
                  Not Enrolled
                  <span className={styles.filterCount}>{notEnrolledCount}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Course Content */}
          <div className={styles.coursesContainer}>
            {filteredCourses.length > 0 ? (
              <div 
                className={viewMode === "card" ? styles.courseGrid : styles.courseList}
                key={`${activeFilter}-${viewMode}-${filteredCourses.length}`} // Force re-render when filter changes
              >
                {/* Render courses directly instead of using memoized grid */}
                {filteredCourses.map((course: PrimeLearningObject, index: number) => {
                  if (!course.localizedMetadata || !course.localizedMetadata[0]) return null;
                  
                  const metadata = course.localizedMetadata[0];
                  const ratingObj = course.rating;
                  const averageRating = ratingObj?.averageRating || 0;
                  const ratingsCount = ratingObj?.ratingsCount || 0;
                  const tags = course.tags || [];
                  const instanceId = course.instances && course.instances[0] ? course.instances[0].id : "";
                  const courseUrl = `http://localhost:4503/content/learning/language-masters/en/overview.html/trainingId/${course.id}/trainingInstanceId/${instanceId}/home.html`;
                  const fallbackImage = "https://fastly.picsum.photos/id/60/1920/1200.jpg?hmac=fAMNjl4E_sG_WNUjdU39Kald5QAHQMh-_-TsIbbeDNI";
                  
                  // Card view rendering
                  if (viewMode === "card") {
                    return (
                      <div key={`card-${course.id}-${index}`} className={styles.courseTile}>
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
                              <span className={styles.ratingLabel}>Course Rating: </span>
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
                            {availableCourses.has(course.id) ? (
                              <a
                                href={courseUrl}
                                className={styles.availableButton}
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                View Course
                              </a>
                            ) : (
                              <span className={styles.disabledButton}>
                                Not Enrolled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } 
                  // List view rendering
                  else {
                    return (
                      <div key={`list-${course.id}-${index}`} className={styles.courseListItem}>
                        <div className={styles.listItemImage}>
                          <img
                            src={course.imageUrl || fallbackImage}
                            alt={metadata.name || "Course image"}
                            className={styles.courseImage}
                            onError={(e) => {
                              e.currentTarget.src = fallbackImage;
                            }}
                          />
                        </div>
                        <div className={styles.listItemContent}>
                          <div className={styles.listItemHeader}>
                            <h3 className={styles.courseTitle}>{metadata.name || "Untitled Course"}</h3>
                            <div className={styles.courseRating}>
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
                          </div>
                          
                          {tags && tags.length > 0 && (
                            <div className={styles.tagsList}>
                              {tags.map((tag, tagIndex) => (
                                <span key={tagIndex} className={styles.tag}>{tag}</span>
                              ))}
                            </div>
                          )}
                          
                          <p className={styles.courseDescription}>
                            {metadata.description ?
                              (metadata.description.length > 150 ?
                                `${metadata.description.substring(0, 150)}...` :
                                metadata.description) :
                              "No description available"}
                          </p>
                          
                          <div className={styles.listItemFooter}>
                            {availableCourses.has(course.id) ? (
                              <a
                                href={courseUrl}
                                className={styles.availableButton}
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                View Course
                              </a>
                            ) : (
                              <span className={styles.disabledButton}>
                                Not Enrolled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <p className={styles.noCoursesMessage}>No courses match the selected filter.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserEnrolledLearningObjects;
