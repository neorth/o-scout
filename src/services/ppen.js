import * as Event from "../models/event";
import * as Control from "../models/control";
import * as Course from "../models/course";
import * as PrintArea from "../models/print-area";
import * as CourseAppearance from "../models/course-appearance";
import Projection from "ol/proj/Projection";
import { createXml } from "./xml-utils";

export function parsePPen(doc) {
  const eventTag = doc.getElementsByTagName("event")[0];
  const mapTag = eventTag.getElementsByTagName("map")[0];
  const scale = Number(mapTag.getAttribute("scale"));
  const mapAbsPath = mapTag.getAttribute("absolute-path");
  const warnings = [];

  const controls = Array.from(doc.getElementsByTagName("control")).map(
    parseControl
  );

  const courseControls = Array.from(
    doc.getElementsByTagName("course-control")
  ).reduce((a, cc) => {
    const id = Number(cc.getAttribute("id"));
    const control = Number(cc.getAttribute("control"));
    const nextTag = cc.getElementsByTagName("next");
    let next = undefined;
    if (nextTag && nextTag[0]) {
      next = nextTag[0].getAttribute("course-control");
    }

    a[id] = {
      control,
      next,
    };

    return a;
  }, {});

  const getCourseControls = (id, sequence) => {
    const control = controls.find((c) => c.id === courseControls[id].control);
    const next = courseControls[id].next;

    return [control].concat(next ? getCourseControls(next, sequence + 1) : []);
  };

  const event = Event.create(
    eventTag.getElementsByTagName("title")[0].textContent,
    []
  );
  event.mapFilename = mapAbsPath.substring(
    Math.max(mapAbsPath.lastIndexOf("/"), mapAbsPath.lastIndexOf("\\") + 1)
  );
  event.mapScale = scale;
  event.courseAppearance = CourseAppearance.create(
    parseCourseAppearance(eventTag.getElementsByTagName("course-appearance")[0])
  );
  event.printArea = parsePrintArea(
    eventTag.getElementsByTagName("print-area")[0]
  );

  const courses = Array.from(doc.getElementsByTagName("course"))
    .filter((c) => c.getElementsByTagName("first").length > 0)
    .map((c) => {
      const courseControls = getCourseControls(
        c.getElementsByTagName("first")[0].getAttribute("course-control"),
        0
      );
      const optionsTag = c.getElementsByTagName("options")[0];
      const printScale =
        (optionsTag && Number(optionsTag.getAttribute("print-scale"))) || scale;
      const course = Course.create(
        c.getAttribute("id"),
        c.getElementsByTagName("name")[0].textContent,
        courseControls,
        printScale,
        c.getAttribute("kind")
      );
      course.order = Number(c.getAttribute("order"));
      course.printArea = PrintArea.create(
        parsePrintArea(c.getElementsByTagName("print-area")?.[0])
      );

      return course;
    })
    .sort((a, b) => a.order - b.order);

  parseAllControls(event, eventTag.getElementsByTagName("all-controls")?.[0]);
  courses.forEach((c) => Event.addCourse(event, c));

  parseSpecialObjects(event, doc.getElementsByTagName("special-object"));

  return { ...event, warnings };

  function parseLocation(loc) {
    return [Number(loc.getAttribute("x")), Number(loc.getAttribute("y"))];
  }

  function parseControl(tag) {
    const codeTag = tag.getElementsByTagName("code")[0];
    const id = tag.getAttribute("id");
    return Control.create({
      id: Number(id),
      kind: tag.getAttribute("kind"),
      code: codeTag ? codeTag.textContent : undefined,
      coordinates: parseLocation(tag.getElementsByTagName("location")[0]),
      description: Array.from(tag.getElementsByTagName("description")).reduce(
        (a, dtag) => {
          a[dtag.getAttribute("box")] = dtag.getAttribute("iof-2004-ref");
          return a;
        },
        {}
      ),
    });
  }

  function parseSpecialObjects(event, specialObjectsTags) {
    for (const specialObjectTag of Array.from(specialObjectsTags)) {
      const attributes = {
        ...mapAttributes(specialObjectTag),
        ...mapAttributes(
          specialObjectTag.getElementsByTagName("appearance")?.[0]
        ),
      };
      const coursesTag = specialObjectTag.getElementsByTagName("courses")[0];
      const isAllCourses = coursesTag.getAttribute("all") === "true";
      const courseIds = isAllCourses
        ? event.courses.map(({ id }) => id)
        : Array.from(coursesTag.getElementsByTagName("course")).map(
            (courseTag) => courseTag.getAttribute("course")
          );
      const locations = Array.from(
        specialObjectTag.getElementsByTagName("location")
      ).map((locationTag) =>
        ["x", "y"].map((attribute) =>
          Number(locationTag.getAttribute(attribute))
        )
      );

      const specialObject = {
        ...attributes,
        isAllCourses,
        locations,
      };

      courseIds.forEach((courseId) => {
        const course = event.courses.find((c) => c.id === courseId);
        if (course) {
          course.specialObjects.push({
            ...specialObject,
            locations: [...specialObject.locations],
          });
        } else {
          warnings.push(
            `No course with id ${courseId} found for special object ${attributes.id}.`
          );
        }
      });
      event.specialObjects.push(specialObject);
    }
  }

  function parsePrintArea(printAreaTag) {
    if (!printAreaTag) return { auto: true, restrictToPage: true };
    return {
      auto: printAreaTag.getAttribute("automatic") === "true",
      restrictToPage:
        printAreaTag.getAttribute("restrict-to-page-size") === "true",
      extent: ["left", "bottom", "right", "top"].map((attr) =>
        Number(printAreaTag.getAttribute(attr))
      ),
      pageWidth: Number(printAreaTag.getAttribute("page-width")),
      pageHeight: Number(printAreaTag.getAttribute("page-height")),
      pageMargins: Number(printAreaTag.getAttribute("page-margins")),
      // Landscape temporarily disabled since O-Scout does not support it yet
      //      pageLandscape: printAreaTag.getAttribute("page-landscape") === "true",
      pageLandscape: false,
    };
  }

  function parseCourseAppearance(courseAppearanceTag) {
    if (!courseAppearanceTag)
      return {
        scaleSizes: "RelativeToMap",
        scaleSizesCircleGaps: true,
        autoLegGapSize: 0,
        blendPurple: true,
      };
    return {
      scaleSizes:
        courseAppearanceTag.getAttribute("scale-sizes") || "RelativeToMap",
      scaleSizesCircleGaps:
        courseAppearanceTag.getAttribute("scale-sizes-circle-gaps") === "true",
      autoLegGapSize:
        Number(courseAppearanceTag.getAttribute("auto-leg-gap-size")) || 0,
      blendPurple: courseAppearanceTag.getAttribute("blend-purple") === "true",
      controlCircleSizeRatio:
        Number(courseAppearanceTag.getAttribute("control-circle-size-ratio")) ||
        1,
      lineWidthRatio:
        Number(courseAppearanceTag.getAttribute("line-width-ratio")) || 1,

      numberSizeRatio:
        Number(courseAppearanceTag.getAttribute("number-size-ratio")) || 1,
    };
  }

  function parseAllControls(event, allControlsTag) {
    if (!allControlsTag) return;

    const allControls = Event.getAllControls(event);
    allControls.printScale = Number(allControlsTag.getAttribute("print-scale"));
  }
}

export function writePpen(event) {
  const doc = document.implementation.createDocument("", "", null);
  const root = createXml(doc, Event.toPpen(event));

  doc.appendChild(root);
  return doc;
}

function mapAttributes(tag) {
  if (!tag) return {};
  const attributes = {};
  for (const attribute of Array.from(tag.getAttributeNames())) {
    const attributeValue = tag.getAttribute(attribute);
    attributes[attribute] = !isNaN(attributeValue)
      ? Number(attributeValue)
      : attributeValue;
  }

  return attributes;
}

export const ppenProjection = new Projection({
  code: "ppen",
  units: "m",
  axisOrientation: "enu",
  global: false,
  metersPerUnit: 0.001,
});
