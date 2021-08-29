import { renderHook, act } from "@testing-library/react-hooks";
import useEvent from "./store";

describe("store", () => {
  test("can set name", () => {
    const { result } = renderHook(() => useEvent());
    act(() => {
      result.current.actions.event.setName("krfsm");
    });
    expect(result.current.name).toBe("krfsm");
  });
  test("can undo", () => {
    const { result } = renderHook(() => useEvent());
    const originalName = result.current.name;
    act(() => {
      result.current.actions.event.setName("krfsm");
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.name).toBe(originalName);
  });

  test("can redo", () => {
    const { result } = renderHook(() => useEvent());
    act(() => {
      result.current.actions.event.setName("krfsm");
    });

    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    expect(result.current.name).toBe("krfsm");
  });

  test("undo past start of history is no-op", () => {
    const { result } = renderHook(() => useEvent());
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.undo();
      });
    }
  });

  test("redo past end of history is no-op", () => {
    const { result } = renderHook(() => useEvent());
    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.redo();
      });
    }
  });

  test("history is 40 steps", () => {
    const { result } = renderHook(() => useEvent());
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.actions.event.setName(i.toString());
      });
    }
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.undo();
      });
    }
    expect(result.current.name).toBe("9");
  });

  test("can set control description", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.addControl(
        { kind: "normal", coordinates: [0, 0] },
        result.current.courses[0].id
      )
    );

    const controlId = Math.max(...Object.keys(result.current.controls));

    act(() =>
      result.current.actions.control.setDescription(controlId, { all: "14.03" })
    );

    expect(result.current.controls[controlId].description.all).toBe("14.03");
    expect(result.current.courses[0].controls[0].description.all).toBe("14.03");
  });

  test("can undo set control description", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.addControl(
        { kind: "normal", coordinates: [0, 0] },
        result.current.courses[0].id
      )
    );

    const controlId = Math.max(...Object.keys(result.current.controls));

    act(() =>
      result.current.actions.control.setDescription(controlId, { all: "14.03" })
    );

    act(() => result.current.undo());

    expect(result.current.controls[controlId].description.all).toBeFalsy();
    expect(
      result.current.courses[0].controls[
        result.current.courses[0].controls.length - 1
      ].description.all
    ).toBeFalsy();
  });

  test("setting map sets print scale for course without controls", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.setMap(
        { getCrs: () => ({ scale: 4000 }) },
        "olle.ocd"
      )
    );

    result.current.courses.forEach((course) =>
      expect(course.printScale).toBe(4000)
    );
  });

  test("setting map leaves print scale for course with controls", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.addControl(
        { kind: "normal", coordinates: [0, 0] },
        result.current.courses[0].id
      )
    );

    act(() =>
      result.current.actions.event.setMap(
        { getCrs: () => ({ scale: 4000 }) },
        "olle.ocd"
      )
    );

    expect(result.current.courses[0].printScale).toBe(15000);
  });

  test("setting map sets event's map name", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.setMap(
        { getCrs: () => ({ scale: 4000 }) },
        "olle.ocd"
      )
    );

    expect(result.current.mapFilename).toBe("olle.ocd");
  });

  test("creating a new event sets event's map name to current map", () => {
    const { result } = renderHook(() => useEvent());
    act(() =>
      result.current.actions.event.setMap(
        { getCrs: () => ({ scale: 4000 }) },
        "olle.ocd"
      )
    );
    act(() => result.current.actions.event.newEvent());

    expect(result.current.mapFilename).toBe("olle.ocd");
  });
});
