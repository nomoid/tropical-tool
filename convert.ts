function convert() {
    readData((data, pathLength) => {
        if (data) {
            const xml = convertToXML(data);
            const segments = processSegments(pathLength, xml);
            if (segments.length > 0) {
                const poly = convertToPoly(segments);
                console.dir(poly);
                const code = convertToCode(poly);
                displayOutput(code);
            }
        }
    });
}

const defaultPathLength = 16;

function readData(callback: (x: string | null, y: number) => void) {
    const element = document.getElementById("inputFile") as HTMLInputElement;
    if (!element.files || element.files.length < 1) {
        callback(null, defaultPathLength);
        return;
    }
    const pathLengthElement = document.getElementById("pathLength") as HTMLInputElement;
    const pathLength = parseInt(pathLengthElement.value);
    const file = element.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
        const result = event.target?.result as string;
        callback(result, pathLength);
    };
    reader.readAsText(file);
}

function convertToXML(data: string) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(data, "text/xml");
    return xml;
}

function gcdSegment(a: number, b: number) {
    a = Math.abs(a);
    b = Math.abs(b);
    if (a === 0) {
        return b;
    }
    if (b === 0) {
        return a;
    }
    if (b > a) { let temp = a; a = b; b = temp; }
    while (true) {
        if (b == 0) return a;
        a %= b;
        if (a == 0) return b;
        b %= a;
    }
}

function compareSegment(a: number[][],
    b: number[][]) {
    const ax1 = a[0][0];
    const ay1 = a[0][1];
    const ax2 = a[1][0];
    const ay2 = a[1][1];
    const bx1 = b[0][0];
    const by1 = b[0][1];
    const bx2 = b[1][0];
    const by2 = b[1][1];
    const cx1 = ax1 - bx1;
    if (cx1 !== 0) {
        return cx1;
    }
    const cy1 = ay1 - by1;
    if (cy1 !== 0) {
        return cy1;
    }
    const cx2 = ax2 - bx2;
    if (cx2 !== 0) {
        return cx2;
    }
    const cy2 = ay2 - by2;
    if (cy2 !== 0) {
        return cy2;
    }
    return 0;
}

function processSegments(pathLength: number, xml: Document) {
    const ipe = xml.getElementsByTagName("ipe")[0];
    const page = ipe.getElementsByTagName("page")[0];
    const paths = page.getElementsByTagName("path");
    let segments: Array<[[number, number], [number, number]]> = [];
    // Get segments from xml
    for (const path of paths) {
        const contents = path.childNodes[0].nodeValue;
        if (contents == null) {
            continue;
        }
        const lines = contents.split("\n");
        let lastX = null;
        let lastY = null;
        for (const line of lines) {
            if (line.length === 0) {
                continue;
            }
            const parts = line.split(" ");
            const x = parseInt(parts[0]);
            const y = parseInt(parts[1]);
            if (lastX != null && lastY != null) {
                segments.push([[lastX, lastY], [x, y]])
            }
            lastX = x;
            lastY = y;
        }
    }
    if (segments.length === 0) {
        return [];
    }
    // Find min x and y coordinate
    let minX = segments[0][0][0];
    let minY = segments[0][0][1];
    for (const segment of segments) {
        for (const point of segment) {
            if (point[0] < minX) {
                minX = point[0];
            }
            if (point[1] < minY) {
                minY = point[1];
            }
        }
    }
    // Scale to Newton polygon coordinates
    const scaledSegments = segments.map((segment) => {
        return segment.map((point) => {
            return [Math.floor((point[0] - minX) / pathLength),
            Math.floor((point[1] - minY) / pathLength)];
        });
    });
    // console.log("Scaled:");
    // for (const segment of scaledSegments) {
    //     console.log(`(${segment[0][0]}, ${segment[0][1]}) => (${segment[1][0]}, ${segment[1][1]})`);
    // }
    // Split longer segments into shorter ones (with no lattice points other than endpoints)
    const splitSegments = scaledSegments.flatMap((segment) => {
        const x1 = segment[0][0];
        const y1 = segment[0][1];
        const x2 = segment[1][0];
        const y2 = segment[1][1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const absGCD = gcdSegment(dx, dy);
        let splits = [];
        for (let i = 0; i < absGCD; i++) {
            splits.push([[x1 + dx * i / absGCD, y1 + dy * i / absGCD],
            [x1 + dx * (i + 1) / absGCD, y1 + dy * (i + 1) / absGCD]]);
        }
        return splits;
    });
    // console.log("Split:");
    // for (const segment of splitSegments) {
    //     console.log(`(${segment[0][0]}, ${segment[0][1]}) => (${segment[1][0]}, ${segment[1][1]})`);
    // }
    // Sort and deduplicate segments
    const sortedSegments = splitSegments.map((segment) => {
        const x1 = segment[0][0];
        const y1 = segment[0][1];
        const x2 = segment[1][0];
        const y2 = segment[1][1];
        if (x2 < x1 || x2 == x1 && y2 < y1) {
            return [[x2, y2], [x1, y1]];
        }
        else {
            return segment;
        }
    }).sort((a, b) => {
        return compareSegment(a, b);
    });
    let deduplicatedSegments = [sortedSegments[0]];
    let lastSegment = sortedSegments[0];
    for (const segment of sortedSegments) {
        if (compareSegment(lastSegment, segment) !== 0) {
            deduplicatedSegments.push(segment);
            lastSegment = segment;
        }
    }
    // console.log("Sorted and deduplicated:");
    // for (const segment of deduplicatedSegments) {
    //     console.log(`(${segment[0][0]}, ${segment[0][1]}) => (${segment[1][0]}, ${segment[1][1]})`);
    // }
    return deduplicatedSegments;
}

function pointString(point: number[] | string) {
    if (typeof point === "string") {
        return point;
    }
    return `(${point[0]},${point[1]})`;
}

function segmentString(segment: number[][]) {
    return `${pointString(segment[0])} => ${pointString(segment[1])}`;
}

function pointSegmentString(point: number[] | string, segment: number[][]) {
    return `${pointString(point)}: ${segmentString(segment)}`;
}

function addMulti<K, V>(map: Map<K, V[]>, key: K, value: V) {
    if (!map.has(key)) {
        map.set(key, []);
    }
    const arr = map.get(key);
    arr?.push(value);
}

function removeMulti<K, V>(map: Map<K, V[]>, key: K, value: V, equality: (a: V, b: V) => boolean) {
    if (!map.has(key)) {
        return;
    }
    const arr = map.get(key) as V[];
    let removeIndex = -1;
    for (let i = 0; i < arr.length; i++) {
        if (equality(value, arr[i])) {
            removeIndex = i;
            break;
        }
    }
    if (removeIndex >= 0) {
        arr.splice(removeIndex, 1);
    }
    if (arr.length === 0) {
        map.delete(key);
    }
}

function pointEquals(a: number[], b: number[]) {
    return pointString(a) === pointString(b);
}

function segmentEquals(a: number[][], b: number[][]) {
    return segmentString(a) === segmentString(b);
}

function segmentOtherPoint(segment: number[][], point: number[]) {
    if (pointEquals(segment[0], point)) {
        return segment[1];
    }
    else {
        return segment[0];
    }
}

function smallestPoint(pointToValue: Map<string, number[]>, points: IterableIterator<string>) {
    let sx = undefined;
    let sy = undefined;
    for (const point of points) {
        let pv = pointToValue.get(point);
        if (pv === undefined) {
            throw "No value for point.";
        }
        let px = pv[0];
        let py = pv[1];
        if (sx === undefined || sy === undefined || px < sx || (px == sx && py < sy)) {
            sx = px;
            sy = py;
        }
    }
    if (sx === undefined || sy === undefined) {
        throw "No smallest point";
    }
    return [sx, sy];
}

function containsPoint(points: number[][], point: number[]) {
    for (const p of points) {
        if (pointString(p) === pointString(point)) {
            return true;
        }
    }
    return false;
}

function convertToPoly(segments: number[][][]) {
    let pointToValue = new Map<string, number[]>();
    let pointToSegments = new Map<string, number[][][]>();
    let pointSegmentAngle = new Map<string, number>();
    let boundarySegments = new Set<string>();
    let pointMap = new Map<string, number>();
    let points: number[][] = [];
    // Make point to number/value/segment maps
    for (const segment of segments) {
        const from = segment[0];
        const to = segment[1];
        addMulti(pointToSegments, pointString(from), segment);
        addMulti(pointToSegments, pointString(to), segment);
        if (!pointMap.has(pointString(from))) {
            pointMap.set(pointString(from), pointMap.size);
            points.push(from);
        }
        if (!pointMap.has(pointString(to))) {
            pointMap.set(pointString(to), pointMap.size);
            points.push(to);
        }
        pointToValue.set(pointString(from), from);
        pointToValue.set(pointString(to), to);
    }
    // Make segment angle map
    for (const segment of segments) {
        const x1 = segment[0][0];
        const y1 = segment[0][1];
        const x2 = segment[1][0];
        const y2 = segment[1][1];
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const modifiedAngle = (angle + 5 * Math.PI / 2) % (Math.PI * 2);
        pointSegmentAngle.set(pointSegmentString(segment[0], segment), modifiedAngle);
        const modifiedAngleInverse = (modifiedAngle + Math.PI) % (Math.PI * 2);
        pointSegmentAngle.set(pointSegmentString(segment[1], segment), modifiedAngleInverse);
    }
    // Sort point to segment map in increasing angle
    for (const entry of pointToSegments.entries()) {
        const point = entry[0];
        const segments = entry[1];
        segments.sort((a, b) => {
            const angleA = pointSegmentAngle.get(pointSegmentString(point, a)) || 0;
            const angleB = pointSegmentAngle.get(pointSegmentString(point, b)) || 0;
            return angleA - angleB;
        });
    }
    // Find boundary segments
    // - Start at point with smallest X (input is already sorted by min X)
    const startPoint = smallestPoint(pointToValue, pointToSegments.keys());
    let currentPoint = startPoint;
    // - Choose smallest angle edge as starting edge (segments sorted by angle)
    const startOptions = pointToSegments.get(pointString(currentPoint));
    if (startOptions === undefined) {
        throw "No starting point.";
    }
    let currentSegment = startOptions[0];
    // - Loop through edges and mark them as boundary
    while (true) {
        if (boundarySegments.has(segmentString(currentSegment))) {
            throw "Repeated boundary segment.";
        }
        boundarySegments.add(segmentString(currentSegment));
        // Find next point
        currentPoint = segmentOtherPoint(currentSegment, currentPoint);
        if (pointEquals(currentPoint, startPoint)) {
            break;
        }
        // Find next segment
        const nextPointSegments = pointToSegments.get(pointString(currentPoint));
        if (nextPointSegments === undefined) {
            throw "Segments not found";
        }
        const nextSegmentCandidates: number[][][] = [];
        nextSegmentCandidates.push(...nextPointSegments, ...nextPointSegments);
        let nextSegment = undefined;
        for (let i = 0; i < nextSegmentCandidates.length; i++) {
            if (segmentEquals(currentSegment, nextSegmentCandidates[i])) {
                nextSegment = nextSegmentCandidates[i + 1];
                break;
            }
        }
        if (nextSegment === undefined) {
            throw "Matching segment not found";
        }
        currentSegment = nextSegment;
    }
    let triangulations: number[][][] = [];
    // Find triangulations
    while (pointToSegments.size > 0) {
        // - Start at point with smallest X (input is already sorted by min X)
        const startPoint = smallestPoint(pointToValue, pointToSegments.keys());
        let currentPoint = startPoint;
        // - Choose smallest angle edge as starting edge (segments sorted by angle)
        const startOptions = pointToSegments.get(pointString(currentPoint));
        if (startOptions === undefined) {
            throw "No starting point.";
        }
        let currentSegment = startOptions[0];
        let triangulation: number[][] = [];
        // - Loop through edges and add them to triangulation
        while (true) {
            // console.log(pointString(currentPoint));
            triangulation.push(currentPoint);
            // Find next point
            currentPoint = segmentOtherPoint(currentSegment, currentPoint);
            let skipNext = false;
            if (pointEquals(currentPoint, startPoint)) {
                skipNext = true;
            }
            let nextSegment = undefined;
            if (!skipNext) {
                if (containsPoint(triangulation, currentPoint)) {
                    throw "Repeated triangulation point.";
                }
                // Find next segment
                const nextPointSegments = pointToSegments.get(pointString(currentPoint));
                if (nextPointSegments === undefined) {
                    throw "Segments not found";
                }
                const nextSegmentCandidates: number[][][] = [];
                nextSegmentCandidates.push(...nextPointSegments, ...nextPointSegments);
                let found = false;
                for (let i = 0; i < nextSegmentCandidates.length; i++) {
                    // console.log(`${segmentString(currentSegment)} vs ${segmentString(nextSegmentCandidates[i])}`);
                    if (segmentEquals(currentSegment, nextSegmentCandidates[i])) {
                        if (!found) {
                            found = true;
                        }
                        else {
                            nextSegment = nextSegmentCandidates[i - 1];
                            break;
                        }
                    }
                }
                if (nextSegment === undefined) {
                    throw "Matching segment not found";
                }
            }
            // Mark segment as used
            if (boundarySegments.has(segmentString(currentSegment))) {
                boundarySegments.delete(segmentString(currentSegment));
                const from = currentSegment[0];
                const to = currentSegment[1];
                removeMulti(pointToSegments, pointString(from), currentSegment, segmentEquals);
                removeMulti(pointToSegments, pointString(to), currentSegment, segmentEquals);
            }
            else {
                boundarySegments.add(segmentString(currentSegment));
            }
            if (skipNext) {
                break;
            }
            if (nextSegment === undefined) {
                throw "No next segment."
            }
            currentSegment = nextSegment;
        }
        triangulations.push(triangulation);
    }
    // Map triangulation points to indicies
    let indexTriangulations = [];
    for (const triangulation of triangulations) {
        const indexTriangulation = triangulation.map((point) => {
            const mapped = pointMap.get(pointString(point));
            if (mapped == undefined) {
                throw "Not found in point map."
            }
            return mapped;
        })
        indexTriangulations.push(indexTriangulation);
    }
    const ret = {
        points: points,
        maximalCells: indexTriangulations
    };
    return ret;
}

function convertToCode(poly: { points: number[][], maximalCells: number[][] }) {
    const points = poly.points;
    const maximalCells = poly.maximalCells;
    let s = `application "tropical";\n` +
        `application "fan";\n` +
        `\n` +
        `# Set up Newton polygon with subdivision\n` +
        `$points = ${JSON.stringify(points)};\n` +
        `$maximalCells = ${JSON.stringify(maximalCells)};\n` +
        `$pointMatrix = (ones_vector<Rational>(${points.length})) | (new Matrix<Rational>($points));\n` +
        `$sigma = new SubdivisionOfPoints(POINTS=>$pointMatrix, MAXIMAL_CELLS=>$maximalCells);\n`;
    s += `\n`;
    const regular = document.getElementById("doCheckRegular") as HTMLInputElement;
    if (regular.checked) {
        s += `# Check for regularity and print weights if regular\n`;
        s += `if($sigma->REGULAR){\n`;
        s += `    print "The subdivision is regular.\\n";\n`;
        s += `    print "The following weights allow the subdivision to be regular:\\n";\n`;
        s += `    $weights = $sigma->WEIGHTS;\n`;
        s += `    $mat = vector2row($weights);\n`;
        s += `    $len = $weights->dim();\n`;
        s += `    for my $i (0 .. $len-1) {\n`;
        s += `        print $\{$\{$points}[$i]}[0], ",", $\{$\{$points}[$i]}[1], ": ", $mat->elem(0,$i), "\\n";\n`;
        s += `    }\n`;
        s += `} else {\n`;
        s += `    print "The subdivision is not regular.\\n";\n`;
        s += `}\n`;
        s += `\n`;
    }
    const unimodular = document.getElementById("doCheckUnimodular") as HTMLInputElement;
    if (unimodular.checked) {
        s += `# Check for unimodularity\n`;
        s += `if($sigma->UNIMODULAR){\n`;
        s += `    print "The subdivision is unimodular.\\n";\n`;
        s += `} else {\n`;
        s += `    print "The subdivision is not unimodular.\\n";\n`;
        s += `}\n`;
        s += `\n`;
    }
    const visualize = document.getElementById("doVisualize") as HTMLInputElement;
    if (visualize.checked) {
        s += `# Visualize\n`;
        s += `$sigma->VISUAL;\n`;
        s += `\n`;
    }
    return s;
}

function displayOutput(s: string) {
    const outputBox = document.getElementById("outputBox") as HTMLDivElement;
    outputBox.hidden = false;
    const output = document.getElementById("output") as HTMLElement;
    output.innerHTML = s;
}