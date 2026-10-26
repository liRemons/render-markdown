import { driver } from 'driver.js';
import "driver.js/dist/driver.css";

type StepItem = {
  // 引导元素
  element: string;
  popover: {
    // 标题
    title: string;
    // 描述
    description: string;
  }
  isShow?: boolean; // 是否展示引导，如果为 false，则不展示引导
}

type Data = Array<{
  // 当前引导的步骤
  steps: Array<StepItem>;
  // 当前引导的条件，成立则运行引导，否则进行下一个引导
  condition?: () => boolean;
  // 引导打开时调用
  onOpen?: () => void;
  id: string;
}>

/** 当前正在展示的 driver 实例 */
let activeDriver: ReturnType<typeof driver> | null = null;

/** 已完成/已放弃的引导队列（按调用方传入的 data 数组引用识别），同一队列不重复弹出 */
const completedQueues = new WeakSet<object>();

/**
 * 用于渲染引导
 * @param data 引导数据，数组结构，每一项为一个引导
 *
 * 语义：同一 data 引用只完整播放一次；播放过程中重复调用会被忽略（不再中途改写队列数据，
 * 避免旧实现的 latestData 竞态：播放中更新 data 导致步骤与队列错位）。
 */
export default function driverRender(data: Data) {
  // 已有引导正在展示，或该队列已播放过
  if (activeDriver || completedQueues.has(data)) {
    return;
  }

  const renderGuide = (index: number) => {
    if (index >= data.length) {
      activeDriver = null;
      completedQueues.add(data);
      return;
    }

    const current = data[index];

    // 检查 condition，若不成立则跳过当前引导，渲染下一个
    if (current.condition && !current.condition()) {
      renderGuide(index + 1);
      return;
    }

    current?.onOpen?.();

    // 只保留当前文档中真实存在的步骤元素：引导配置可能来自宿主应用，
    // 元素不存在时 driver.js 会报错中断整个引导
    const steps = current.steps.filter((step) => step.isShow !== false && !!document.querySelector(step.element));
    if (steps.length === 0) {
      renderGuide(index + 1);
      return;
    }

    const driverObj = driver({
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '我知道了',
      showProgress: true,
      allowClose: false,
      progressText: '第 {{current}} 步，共 {{total}} 步',
      onDestroyed: () => {
        activeDriver = null;
        renderGuide(index + 1);
      },
      steps
    });
    activeDriver = driverObj;
    driverObj.drive();
  };

  renderGuide(0);
}
