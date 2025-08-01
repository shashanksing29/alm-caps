/**
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
import { Tabs, TabList, Tab, TabPanels, TabPanel, ContainedList, ContainedListItem } from "@carbon/react";
import { Item, TabList as SpectrumTabList, TabPanels as SpectrumTabPanels, Tabs as SpectrumTabs } from "@react-spectrum/tabs";
import React from "react";
import { useEffect, useState, useMemo } from "react";
import { useIntl } from "react-intl";
import {
  PrimeLearningObject,
  PrimeLearningObjectInstance,
  PrimeLearningObjectResource,
  PrimeNote,
} from "../../../models/PrimeModels";
import { CONTENT, PREWORK, TESTOUT } from "../../../utils/constants";
import { convertSecondsToTimeText } from "../../../utils/dateTime";
import {
  filterLoReourcesBasedOnResourceType,
  getDuration,
} from "../../../utils/hooks";
import {
  getPreferredLocalizedMetadata,
  GetTranslation,
} from "../../../utils/translationService";
import { PrimeModuleList } from "../PrimeModuleList";
import { PrimeNoteList } from "../PrimeNoteList";
import styles from "./PrimeCourseOverview.module.css";
import Email from "@spectrum-icons/workflow/Email";
import Download from "@spectrum-icons/workflow/Download";
import { ALMLoader } from "../../Common/ALMLoader";

const PrimeCourseOverview: React.FC<{
  locale?: String;
  training: PrimeLearningObject;
  trainingInstance: PrimeLearningObjectInstance;
  launchPlayerHandler: Function;
  isParentLOEnrolled?: boolean;
  isPartOfLP?: boolean;
  isParentFlexLP?: boolean;
  showDuration?: boolean;
  showNotes: boolean;
  isPreviewEnabled: boolean;
  updateFileSubmissionUrl: Function;
  lastPlayingLoResourceId: String;
  setTimeBetweenAttemptEnabled: Function;
  timeBetweenAttemptEnabled: boolean;
  updateNote: (
    note: PrimeNote,
    updatedText: string,
    loId: string,
    loResourceId: PrimeLearningObjectResource
  ) => Promise<void | undefined>;
  deleteNote: (
    noteId: string,
    loId: string,
    loResourceId: string
  ) => Promise<void | undefined>;
  downloadNotes: (
    loId: string,
    loInstanceId: string,
    courseName: string
  ) => Promise<void | undefined>;
  sendNotesOnMail: (
    loId: string,
    loInstanceId: string
  ) => Promise<void | undefined>;
  getAllNotes: (
    loId: string, 
    loInstanceId: string
  ) => Promise<PrimeNote[] | undefined>;
}> = (props: any) => {
  const {
    training,
    trainingInstance,
    showDuration = true,
    showNotes,
    launchPlayerHandler,
    isPartOfLP = false,
    isParentLOEnrolled = false,
    isPreviewEnabled = false,
    isParentFlexLP = false,
    updateFileSubmissionUrl,
    updateNote,
    deleteNote,
    getAllNotes,
    downloadNotes,
    sendNotesOnMail,
    lastPlayingLoResourceId,
    setTimeBetweenAttemptEnabled,
    timeBetweenAttemptEnabled,
  } = props;

  const { locale } = useIntl();
  interface INotesbyModuleName {
    moduleName: string;
    moduleId: string;
    notes: PrimeNote[];
  }
  interface INotesByNamesAndId {
    [key: string]: INotesbyModuleName;
  }

  let moduleResources = filterLoReourcesBasedOnResourceType(
    trainingInstance,
    CONTENT
  );
  const testOutResources = filterLoReourcesBasedOnResourceType(
    trainingInstance,
    TESTOUT
  );

  let preWorkResources = filterLoReourcesBasedOnResourceType(
    trainingInstance,
    PREWORK
  );

  const contentModuleDuration = getDuration(moduleResources, locale);

  if (isPartOfLP) {
    moduleResources = [...preWorkResources, ...moduleResources];
    preWorkResources = [] as PrimeLearningObjectResource[];
  }

  let [preWorkDuration, setPreWorkDuration] = useState(0);
  useEffect(() => {
    if (preWorkResources?.length) {
      setPreWorkDuration(getDuration(preWorkResources, locale));
    }
  }, [locale, preWorkResources]);

  const [notes, setNotesData] = useState([] as PrimeNote[]);
  const [loading, setLoading] = useState(false);
  const showTestout = testOutResources?.length !== 0;
  const showTabs = isPartOfLP ? false : showTestout || showNotes;
  const showNotesTab = showNotes && lastPlayingLoResourceId;
  const classNames = `${styles.tablist} ${showTabs ? "" : styles.hide}`;
  const getModuleId = useMemo(() => {
    const getIds = () => {
      let moduleIds: string[] = [];
      moduleResources.forEach((element) => {
        moduleIds.push(element.id);
      });
      return moduleIds;
    };
    return getIds();
  }, [moduleResources]);
  const notesByModuleName = useMemo(() => {
    const filterNotesByModuleName = (notesList: PrimeNote[]) => {
      const notesbyModuleId = notesList.reduce(function (
        accumulator: INotesByNamesAndId,
        note: PrimeNote
      ) {
        const metaData = getPreferredLocalizedMetadata(
          note?.loResource?.localizedMetadata,
          locale
        );
        const moduleId = note?.loResource?.id;
        if (!accumulator[moduleId]) {
          accumulator[moduleId] = {
            notes: [],
            moduleName: metaData.name,
            moduleId: moduleId,
          };
        }
        accumulator[moduleId].notes.push(note);
        return accumulator;
      },
      {});
      return Object.keys(notesbyModuleId).map(
        (id: string) => notesbyModuleId[id]
      );
    };
    return filterNotesByModuleName(notes);
  }, [notes]);
  const sortNotesByModuleResourceIds = useMemo(() => {
    const moduleIds = getModuleId;
    return notesByModuleName.sort(
      (a, b) => moduleIds.indexOf(a.moduleId) - moduleIds.indexOf(b.moduleId)
    );
  }, [notesByModuleName]);
  const memoizedNotesByModuleId = useMemo(() => {
    return notesByModuleName.map((item, index) => {
      if (item.notes) {
        const areMarkersSame = item.notes.every(
          (note) => note.marker === item.notes[0].marker
        );
        if (areMarkersSame) {
          item.notes.reverse();
        } else {
          item.notes.sort(
            (a, b) => parseFloat(a.marker) - parseFloat(b.marker)
          );
        }
      }
      return item;
    });
  }, [notesByModuleName]);
  const handleNotesDownload = () => {
    let courseName = "";
    const localizedMetadata = training.localizedMetadata;
    localizedMetadata.forEach((data: { locale: string; name: string; }) => {
      if(data.locale === locale)
        courseName = data.name;
    });
    downloadNotes(training.id, trainingInstance.id, courseName);
  };

  const handleNotesMailing = () => {
    sendNotesOnMail(training.id, trainingInstance.id);
  };

  const handleGetNotes = async() => {
    setLoading(true);
    try {
      let response = await getAllNotes(training.id, trainingInstance.id);
      if (response) {
        setNotesData(response);
      } else {
        setNotesData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {!isPartOfLP && (
    <div className={styles.tabsContainer}>
      <Tabs>
        <TabList className={styles.carbonTabsList} aria-label={GetTranslation("alm.training.tabslist", true)}>
          <Tab>{GetTranslation("alm.training.modules", true)}</Tab>
          {showTestout && <Tab>{GetTranslation("alm.text.testout", true)}</Tab>}
          {showNotesTab && <Tab id="notes-tab" onClick={handleGetNotes}>{GetTranslation("alm.text.notes")}</Tab>}
        </TabList>
        <TabPanels>
          <TabPanel className={styles.tabsPanel}>
            {preWorkResources?.length > 0 && (
              <>
                {/* <div className={styles.overviewcontainer}>
                  <header
                    role="heading"
                    className={styles.header}
                    aria-level={2}
                  >
                    <div className={styles.loResourceType}>
                      {GetTranslation("alm.text.prework", true)}
                    </div>
                    {showDuration && (
                      <div className={styles.time}>
                        {convertSecondsToTimeText(preWorkDuration, locale)}
                      </div>
                    )}
                  </header>
                </div> */}
                <ContainedList
                  label={GetTranslation("alm.text.prework", true)}
                  kind="on-page"
                  className={`${styles.loResourceType} customContainedList`}
                >
                  <PrimeModuleList
                    launchPlayerHandler={launchPlayerHandler}
                    loResources={preWorkResources}
                    training={training}
                    isPartOfLP={isPartOfLP}
                    trainingInstance={trainingInstance}
                    isPreviewEnabled={isPreviewEnabled}
                    updateFileSubmissionUrl={updateFileSubmissionUrl}
                    isParentLOEnrolled={isParentLOEnrolled}
                    isParentFlexLP={isParentFlexLP}
                    lastPlayingLoResourceId={lastPlayingLoResourceId}
                    setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
                    timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
                  ></PrimeModuleList>
                </ContainedList>
              </>
            )}
            {showDuration && (
              <>
                {/* <div className={styles.overviewcontainer}>
                  <header
                    role="heading"
                    className={styles.header}
                    aria-level={2}
                  >
                    <div className={styles.loResourceType}>
                      {GetTranslation("alm.text.coreContent", true)}
                    </div>
                    <div className={styles.time}>
                    {convertSecondsToTimeText(contentModuleDuration, locale)}
                  </div>
                  </header>
                </div> */}
                <ContainedList
                  label={GetTranslation("alm.text.coreContent", true)}
                  kind="on-page"
                  className={`${styles.loResourceType} customContainedList`}
                >
                  <PrimeModuleList
                    launchPlayerHandler={launchPlayerHandler}
                    loResources={moduleResources}
                    training={training}
                    isPartOfLP={isPartOfLP}
                    trainingInstance={trainingInstance}
                    isContent={true}
                    isPreviewEnabled={isPreviewEnabled}
                    updateFileSubmissionUrl={updateFileSubmissionUrl}
                    isParentLOEnrolled={isParentLOEnrolled}
                    isParentFlexLP={isParentFlexLP}
                    lastPlayingLoResourceId={lastPlayingLoResourceId}
                    setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
                    timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
                  ></PrimeModuleList>
                </ContainedList>
              </>
            )}
          </TabPanel>
          <TabPanel>
            {showTestout && (
              <PrimeModuleList
                launchPlayerHandler={launchPlayerHandler}
                loResources={testOutResources}
                training={training}
                isPartOfLP={isPartOfLP}
                trainingInstance={trainingInstance}
                isPreviewEnabled={isPreviewEnabled}
                updateFileSubmissionUrl={updateFileSubmissionUrl}
                isParentLOEnrolled={isParentLOEnrolled}
                isParentFlexLP={isParentFlexLP}
                lastPlayingLoResourceId={lastPlayingLoResourceId}
                setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
                timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
              ></PrimeModuleList>
            )}
          </TabPanel>
          <TabPanel>
            {showNotes && (
              <>
                {Object.keys(notes[0] || {}).length ? (
                  <>
                    <div className={styles.notesActions}>
                      <button className={styles.downloadButton} onClick={handleNotesDownload} aria-label={GetTranslation("alm.training.download", true)}>
                        <span className={styles.downloadIcon}>
                          <Download />
                        </span>
                        <span>{GetTranslation("alm.text.download", true)}</span>
                      </button>
                      <button className={styles.mailButton} onClick={handleNotesMailing} aria-label={GetTranslation("alm.training.email", true)}>
                        <span className={styles.mailIcon}>
                          <Email />
                        </span>
                        <span>{GetTranslation("alm.text.email", true)}</span>
                      </button>
                    </div>
                    {notesByModuleName.map((item: INotesbyModuleName) => (
                      <React.Fragment key={`notes-${item.moduleName}`}>
                        <div className={styles.moduleContainer}>
                          <p className={styles.moduleName}>
                            {item.moduleName ? (
                              <>
                                {GetTranslation("alm.text.moduleName", true)}
                                {item.moduleName}
                              </>
                            ) : (
                              <>{GetTranslation("alm.text.deletedModulesNotes", true)}</>
                            )}
                          </p>
                        </div>
                        <PrimeNoteList
                          training={training}
                          trainingInstance={trainingInstance}
                          notes={item.notes}
                          updateNote={updateNote}
                          deleteNote={deleteNote}
                          launchPlayerHandler={launchPlayerHandler}
                        />
                      </React.Fragment>
                    ))}
                  </>
                ) : ( loading ?
                  <div className={styles.notesNotPresent}>
                    <ALMLoader />
                  </div>
                :
                  <div className={styles.notesNotPresent}>
                    {GetTranslation("alm.text.noNotes")}
                  </div>
                )}
              </>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
    )}

    {/* {isPartOfLP && (
    <SpectrumTabs
      aria-label={GetTranslation("alm.text.moduleList", true)}
      UNSAFE_className={isPartOfLP ? styles.isPartOfLP : ""}
    >
      <SpectrumTabList id="tabList" UNSAFE_className={classNames}>
        <Item key="Modules">
          {GetTranslation("alm.training.modules", true)}
        </Item>
        {showTestout && (
          <Item key="Testout">{GetTranslation("alm.text.testout", true)}</Item>
        )}
        {showNotes && (
          <Item key="Notes">{GetTranslation("alm.text.notes")}</Item>
        )}
      </SpectrumTabList>
      <SpectrumTabPanels UNSAFE_className={styles.tabPanels}>
        <Item key="Modules">
          {preWorkResources?.length > 0 && (
            <>
              <div className={styles.overviewcontainer}>
                <header role="heading" className={styles.header} aria-level={2}>
                  <div className={styles.loResourceType}>
                    {GetTranslation("alm.text.prework", true)}
                  </div>
                  {showDuration && (
                    <div className={styles.time}>
                      {convertSecondsToTimeText(preWorkDuration, locale)}
                    </div>
                  )}
                </header>
              </div>
              <PrimeModuleList
                launchPlayerHandler={launchPlayerHandler}
                loResources={preWorkResources}
                training={training}
                isPartOfLP={isPartOfLP}
                trainingInstance={trainingInstance}
                isPreviewEnabled={isPreviewEnabled}
                updateFileSubmissionUrl={updateFileSubmissionUrl}
                isParentLOEnrolled={isParentLOEnrolled}
                isParentFlexLP={isParentFlexLP}
                lastPlayingLoResourceId={lastPlayingLoResourceId}
                setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
                timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
              ></PrimeModuleList>
            </>
          )}

          {showDuration && (
            <div className={styles.overviewcontainer}>
              <header role="heading" className={styles.header} aria-level={2}>
                <div className={styles.loResourceType}>
                  {GetTranslation("alm.text.coreContent", true)}
                </div>
                <div className={styles.time}>
                  {convertSecondsToTimeText(contentModuleDuration, locale)}
                </div>
              </header>
            </div>
          )}
          <PrimeModuleList
            launchPlayerHandler={launchPlayerHandler}
            loResources={moduleResources}
            training={training}
            isPartOfLP={isPartOfLP}
            trainingInstance={trainingInstance}
            isContent={true}
            isPreviewEnabled={isPreviewEnabled}
            updateFileSubmissionUrl={updateFileSubmissionUrl}
            isParentLOEnrolled={isParentLOEnrolled}
            isParentFlexLP={isParentFlexLP}
            lastPlayingLoResourceId={lastPlayingLoResourceId}
            setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
            timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
          ></PrimeModuleList>
        </Item>
        {showTestout && (
          <Item key="Testout">
            <PrimeModuleList
              launchPlayerHandler={launchPlayerHandler}
              loResources={testOutResources}
              training={training}
              trainingInstance={trainingInstance}
              isPreviewEnabled={isPreviewEnabled}
              updateFileSubmissionUrl={updateFileSubmissionUrl}
              isParentLOEnrolled={isParentLOEnrolled}
              isParentFlexLP={isParentFlexLP}
              lastPlayingLoResourceId={lastPlayingLoResourceId}
              setTimeBetweenAttemptEnabled={setTimeBetweenAttemptEnabled}
              timeBetweenAttemptEnabled={timeBetweenAttemptEnabled}
            ></PrimeModuleList>
          </Item>
        )}
        {showNotes && (
          <Item key="Notes">
            {Object.keys(notes[0] || {}).length ? (
              <>
                <div className={styles.notesActions}>
                  <button className={styles.downloadButton} onClick={handleNotesDownload} aria-label={GetTranslation("alm.training.download", true)}>
                    <span className={styles.downloadIcon}>
                      <Download />
                    </span>
                    <span>{GetTranslation("alm.text.download", true)}</span>
                  </button>
                  <button className={styles.mailButton} onClick={handleNotesMailing} aria-label={GetTranslation("alm.training.email", true)}>
                    <span className={styles.mailIcon}>
                      <Email />
                    </span>
                    <span>{GetTranslation("alm.text.email", true)}</span>
                  </button>
                </div>
                {notesByModuleName.map((item: INotesbyModuleName) => (
                  <React.Fragment key={`notes-${item.moduleName}`}>
                    <div className={styles.moduleContainer}>
                      <p className={styles.moduleName}>
                      {item.moduleName ? (
                        <>
                          {GetTranslation("alm.text.moduleName", true)}
                          {item.moduleName}
                        </>
                      ) : (
                        <>{GetTranslation("alm.text.deletedModulesNotes", true)}</>
                      )}
                      </p>
                    </div>
                    <PrimeNoteList
                      training={training}
                      trainingInstance={trainingInstance}
                      notes={item.notes}
                      updateNote={updateNote}
                      deleteNote={deleteNote}
                      launchPlayerHandler={launchPlayerHandler}
                    />
                  </React.Fragment>
                ))}
              </>
            ) : (
              <div className={styles.notesNotPresent}>
                {GetTranslation("alm.text.noNotes")}
              </div>
            )}
          </Item>
        )}
      </SpectrumTabPanels>
    </SpectrumTabs>
    )} */}
    </>
  );
};

export default PrimeCourseOverview;
