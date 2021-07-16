/* Copyright 2021 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import {Injectable} from '@angular/core';
import {EMPTY, Observable, of} from 'rxjs';
import {map, tap} from 'rxjs/operators';

import {LocalStorage} from '../../util/local_storage';
import {BackendSettings, PersistableSettings} from './types';

const LEGACY_METRICS_LOCAL_STORAGE_KEY = '_tb_global_settings.timeseries';
const GLOBAL_LOCAL_STORAGE_KEY = '_tb_global_settings';

@Injectable()
export abstract class PersistentSettingsDataSource<UiSettings> {
  abstract setSettings(partialSetting: Partial<UiSettings>): Observable<void>;
  abstract getSettings(): Observable<Partial<UiSettings>>;
}

@Injectable()
export abstract class SettingsConverter<UiSettings, StorageSettings> {
  abstract uiToBackend(
    uiSettings: Partial<UiSettings>
  ): Partial<StorageSettings>;
  abstract backendToUi(
    backendSettings: Partial<StorageSettings>
  ): Partial<UiSettings>;
}

@Injectable()
export class OSSSettingsConverter extends SettingsConverter<
  PersistableSettings,
  BackendSettings
> {
  uiToBackend(settings: PersistableSettings): BackendSettings {
    const serializableSettings: BackendSettings = {
      ignoreOutliers: settings.ignoreOutliers,
      scalarSmoothing: settings.scalarSmoothing,
      // TooltipSort is a string enum and has string values; no need to
      // serialize it differently to account for their unintended changes.
      tooltipSort: settings.tooltipSortString,
    };
    return serializableSettings;
  }
  backendToUi(backendSettings: Partial<BackendSettings>): PersistableSettings {
    const settings: Partial<PersistableSettings> = {};
    if (
      backendSettings.hasOwnProperty('scalarSmoothing') &&
      typeof backendSettings.scalarSmoothing === 'number'
    ) {
      settings.scalarSmoothing = backendSettings.scalarSmoothing;
    }

    if (
      backendSettings.hasOwnProperty('ignoreOutliers') &&
      typeof backendSettings.ignoreOutliers === 'boolean'
    ) {
      settings.ignoreOutliers = backendSettings.ignoreOutliers;
    }

    if (
      backendSettings.hasOwnProperty('tooltipSort') &&
      typeof backendSettings.tooltipSort === 'string'
    ) {
      settings.tooltipSortString = backendSettings.tooltipSort;
    }

    return settings;
  }
}

/**
 * An implementation of PersistentSettingsDataSource that stores global settings
 * in browser local storage.
 */
@Injectable()
export class PersistentSettingsDataSourceImpl<UiSettings, StorageSettings>
  implements PersistentSettingsDataSource<UiSettings> {
  constructor(
    private readonly localStorage: LocalStorage,
    private readonly converter: SettingsConverter<UiSettings, StorageSettings>
  ) {}

  setSettings(partialSetting: Partial<UiSettings>): Observable<void> {
    if (!Object.keys(partialSetting)) {
      return EMPTY;
    }

    return this.getSettings().pipe(
      tap((currentPartialSettings) => {
        this.localStorage.setItem(
          GLOBAL_LOCAL_STORAGE_KEY,
          JSON.stringify(
            this.converter.uiToBackend({
              ...currentPartialSettings,
              ...partialSetting,
            })
          )
        );
        this.localStorage.removeItem(LEGACY_METRICS_LOCAL_STORAGE_KEY);
      }),
      map(() => void null)
    );
  }

  private deserialize(serialized: string): Partial<StorageSettings> {
    try {
      return JSON.parse(serialized) as StorageSettings;
    } catch {
      return {};
    }
  }

  getSettings(): Observable<Partial<UiSettings>> {
    const legacySettings = this.converter.backendToUi(
      this.deserialize(
        this.localStorage.getItem(LEGACY_METRICS_LOCAL_STORAGE_KEY) ?? '{}'
      )
    );
    const settings = this.converter.backendToUi(
      this.deserialize(
        this.localStorage.getItem(GLOBAL_LOCAL_STORAGE_KEY) ?? '{}'
      )
    );
    return of({
      ...legacySettings,
      ...settings,
    });
  }
}

export const TEST_ONLY = {
  LEGACY_METRICS_LOCAL_STORAGE_KEY,
  GLOBAL_LOCAL_STORAGE_KEY,
};