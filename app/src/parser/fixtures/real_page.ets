// 首页 — 视频选择 + 模型配置 + 分析进度 + 历史记录
import { router } from '@kit.ArkUI';
import { picker } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { AppSettings, ModelConfig, DEFAULT_SETTINGS } from '../models/AppConfig';
import { HistoryItem } from '../models/HistoryModel';

// 路由参数接口（ArkTS 要求对象字面量对应声明的接口）
interface RouteParams {
  historyItemId: string;
}

@Entry
@Component
struct Index {
  // 视频选择状态
  @State selectedVideoUri: string = '';
  @State selectedVideoName: string = '';
  @State isVideoSelected: boolean = false;

  // 模型配置
  @State settings: AppSettings = DEFAULT_SETTINGS;
  @State selectedModelId: string = 'groq-llama';

  // 分析状态
  @StorageLink('isAnalyzing') isAnalyzing: boolean = false;
  @State progressStage: string = '';
  @State progressPercent: number = 0;
  @State errorMessage: string = '';

  // 历史记录
  @State historyItems: HistoryItem[] = [];

  async aboutToAppear(): Promise<void> {
    this.selectedModelId = 'groq-llama';
  }

  build() {
    Scroll() {
      Column() {
        // Header
        this.buildHeader();

        // 视频选择卡片
        VideoPickerCard({
          videoName: this.selectedVideoName,
          isSelected: this.isVideoSelected,
          onSelectVideo: () => this.pickVideo(),
        })

        // 开始分析按钮
        if (this.isVideoSelected && !this.isAnalyzing) {
          Button('🚀 开始分析')
            .type(ButtonType.Normal)
            .width('100%')
            .height(48)
            .fontSize(16)
            .fontColor(Color.White)
            .fontWeight(FontWeight.Bold)
            .borderRadius(12)
            .linearGradient({
              direction: GradientDirection.Right,
              colors: [['#667eea', 0], ['#764ba2', 1]],
            })
            .margin({ top: 16 })
            .onClick(() => this.startAnalysis())
        }

        // 错误提示卡片（分析失败后显示）
        if (this.errorMessage.length > 0 && !this.isAnalyzing) {
          Column() {
            Row() {
              Text('❌')
                .fontSize(16)
                .margin({ right: 8 })

              Text('分析失败')
                .fontSize(14)
                .fontColor($r('app.color.error'))
                .fontWeight(FontWeight.Medium)
            }
            .width('100%')
            .margin({ bottom: 8 })

            Text(this.errorMessage)
              .fontSize(13)
              .fontColor('#4a5568')
              .width('100%')

            Row() {
              Button('重试')
                .type(ButtonType.Normal)
                .backgroundColor($r('app.color.primary'))
                .fontColor(Color.White)
                .fontSize(13)
                .borderRadius(8)
                .height(32)
                .layoutWeight(1)
                .margin({ right: 8 })
                .onClick(() => {
                  this.errorMessage = '';
                  this.startAnalysis();
                })
            }
            .width('100%')
            .margin({ top: 12 })
          }
          .width('100%')
          .padding(16)
          .margin({ top: 16 })
          .borderRadius(12)
          .backgroundColor('#fff5f5')
          .borderWidth(1)
          .borderColor('#feb2b2')
        }

        // 历史记录
        this.buildHistorySection();
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 24 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#f0f4ff')
    .scrollBar(BarState.Auto)
  }

  @Builder buildHeader() {
    Row() {
      Column() {
        Text('🎬 视频智能解析')
          .fontSize(22)
          .fontColor(Color.White)
          .fontWeight(FontWeight.Bold)

        Text('选择视频，AI 自动生成解析报告')
          .fontSize(12)
          .fontColor('rgba(255,255,255,0.8)')
          .margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      // 设置按钮 — 使用 Text 替代系统图标
      Text('⚙')
        .fontSize(24)
        .fontColor(Color.White)
        .width(44)
        .height(44)
        .textAlign(TextAlign.Center)
        .onClick(() => {
          router.pushUrl({ url: 'pages/SettingsPage' });
        })
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 20 })
    .linearGradient({
      direction: GradientDirection.Right,
      colors: [['#667eea', 0], ['#764ba2', 1]],
    })
    .borderRadius({ bottomLeft: 16, bottomRight: 16 })
  }

  @Builder buildModelSelector() {
    Row() {
      Text('分析模型:')
        .fontSize(14)
        .fontColor('#4a5568')
        .margin({ right: 8 })

      Select(this.settings.models.map((m: ModelConfig): SelectOption => ({ value: m.name })))
        .width('60%')
        .onSelect((index: number) => {
          this.selectedModelId = this.settings.models[index].id;
          this.saveSelectedModel();
        })
    }
    .width('100%')
    .padding(16)
    .margin({ top: 16 })
    .borderRadius(12)
    .backgroundColor('#ffffff')
    .borderWidth(1)
    .borderColor('#e2e8f0')
  }

  @Builder buildHistorySection() {
    Column() {
      Text('已分析的视频')
        .fontSize(16)
        .fontColor('#2d3748')
        .fontWeight(FontWeight.Medium)
        .margin({ top: 24, bottom: 12 })

      if (this.historyItems.length === 0) {
        Column() {
          Text('暂无分析记录')
            .fontSize(14)
            .fontColor('#a0aec0')
            .margin({ top: 20 })
        }
        .width('100%')
        .justifyContent(FlexAlign.Center)
        .padding(40)
        .borderRadius(12)
        .backgroundColor('#ffffff')
        .borderWidth(1)
        .borderColor('#e2e8f0')
      } else {
        ForEach(this.historyItems, (item: HistoryItem) => {
          HistoryCard({
            item: item,
            onViewReport: (id: string) => this.viewReport(id),
            onDelete: (id: string) => this.deleteHistory(id),
          })
            .margin({ bottom: 8 })
        }, (item: HistoryItem) => item.id)
      }
    }
    .width('100%')
  }

  private getSelectedModelIndex(): number {
    return 0;
  }

  private pickVideo(): void {
    this.isVideoSelected = true;
  }

  private async startAnalysis(): Promise<void> {
    if (!this.isVideoSelected || this.isAnalyzing) {
      return;
    }
    this.isAnalyzing = true;
  }

  private viewReport(id: string): void {
    router.pushUrl({
      url: 'pages/AnalysisPage',
      params: { historyItemId: id } as RouteParams,
    });
  }
}
