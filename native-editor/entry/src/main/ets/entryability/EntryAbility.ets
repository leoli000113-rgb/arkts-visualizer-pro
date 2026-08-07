import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';

const DOMAIN = 0x0000;
const TAG = 'ArkTsEditor';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    try {
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'setColorMode failed: %{public}s', JSON.stringify(err));
    }
    hilog.info(DOMAIN, TAG, 'Ability onCreate');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(DOMAIN, TAG, 'onWindowStageCreate');
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'loadContent failed: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, TAG, 'loadContent succeeded');
    });
    // 编辑器需要完整屏幕：沉浸式全屏 + 系统栏样式
    window.getLastWindow(this.context).then((win: window.Window) => {
      win.setWindowLayoutFullScreen(true).catch((e: BusinessError) => {
        hilog.error(DOMAIN, TAG, 'setWindowLayoutFullScreen failed: %{public}s', JSON.stringify(e));
      });
      win.setWindowSystemBarProperties({
        statusBarColor: '#00000000',
        statusBarContentColor: '#000000',
        navigationBarColor: '#00000000',
        navigationBarContentColor: '#000000'
      }).catch((e: BusinessError) => {
        hilog.error(DOMAIN, TAG, 'setWindowSystemBarProperties failed: %{public}s', JSON.stringify(e));
      });
    }).catch((e: BusinessError) => {
      hilog.error(DOMAIN, TAG, 'getLastWindow failed: %{public}s', JSON.stringify(e));
    });
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, 'Ability onDestroy');
  }
}
