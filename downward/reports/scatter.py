# -*- coding: utf-8 -*-
#
# Downward Lab uses the Lab package to conduct experiments with the
# Fast Downward planning system.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

from collections import defaultdict
import logging
import os

import matplotlib.lines as mlines

from lab import tools

from downward.reports.plot import MatplotlibPlot, Matplotlib, PgfPlots, \
    PlotReport


class ScatterMatplotlib(Matplotlib):
    @classmethod
    def _plot(cls, report, axes, categories, styles):
        has_points = False

        # Display grid.
        axes.grid(b=True, linestyle='-', color='0.75')

        # Draw points for which both algorithms have a value.
        for category, coords in sorted(categories.items()):
            coords = [(x, y) for (x, y) in coords if x is not None and y is not None]
            if coords:
                X, Y = zip(*coords)
                axes.scatter(X, Y, s=42, label=category, **styles[category])
                has_points = True

        axes.autoscale(enable=False)
        xmin, xmax = axes.get_xbound()
        ymin, ymax = axes.get_ybound()

        if report.show_missing:
            # Draw points on axis boundaries for which at least one algorithm has no value.
            for category, coords in sorted(categories.items()):
                coords = [(xmax if x is None else x, ymax if y is None else y) for (x, y) in coords if None in (x, y)]
                if coords:
                    X, Y = zip(*coords)
                    axes.scatter(X, Y, s=42, clip_on=False, label=category, **styles[category])
                    has_points = True

        # Plot a diagonal black line.
        axes.add_line(mlines.Line2D([xmin, xmax], [ymin, ymax], color='k', alpha=0.5))

        for axis in [axes.xaxis, axes.yaxis]:
            MatplotlibPlot.change_axis_formatter(
                axis, report.missing_val if report.show_missing else None)
        return has_points


class ScatterPgfPlots(PgfPlots):
    @classmethod
    def _format_coord(cls, coord):
        def format_value(v):
            return str(v) if isinstance(v, int) else '%f' % v
        return '(%s, %s)' % (format_value(coord[0]), format_value(coord[1]))

    @classmethod
    def _get_plot(cls, report):
        lines = []
        options = cls._get_axis_options(report)
        lines.append('\\begin{axis}[%s]' % cls._format_options(options))
        for category, coords in sorted(report.categories.items()):
            plot = {'only marks': True}
            lines.append(
                '\\addplot+[%s] coordinates {\n%s\n};' % (
                    cls._format_options(plot),
                    ' '.join(cls._format_coord(c) for c in coords)))
            if category:
                lines.append('\\addlegendentry{%s}' % category)
            elif report.has_multiple_categories:
                # None is treated as the default category if using multiple
                # categories. Add a corresponding entry to the legend.
                lines.append('\\addlegendentry{default}')

        # Add black diagonal line.
        lines.append('\\draw[color=black] (rel axis cs:0,0) -- (rel axis cs:1,1);')

        lines.append('\\end{axis}')
        return lines

    @classmethod
    def _get_axis_options(cls, report):
        opts = PgfPlots._get_axis_options(report)
        # Add line for missing values.
        for axis in ['x', 'y']:
            opts['extra %s ticks' % axis] = report.missing_val
            opts['extra %s tick style' % axis] = 'grid=major'
        return opts


class ScatterPlotReport(PlotReport):
    """
    Generate a scatter plot for a specific attribute.
    """
    def __init__(self, show_missing=True, get_category=None, **kwargs):
        """
        See :class:`.PlotReport` for inherited arguments.

        The keyword argument *attributes* must contain exactly one
        attribute.

        Use the *filter_algorithm* keyword argument to select exactly
        two algorithms.

        If only one of the two algorithms has a value for a run, only
        add a coordinate if *show_missing* is True.

        *get_category* can be a function that takes **two** runs
        (dictionaries of properties) and returns a category name. This
        name is used to group the points in the plot. If there is more
        than one group, a legend is automatically added. Runs for which
        this function returns None are shown in a default category and
        are not contained in the legend. For example, to group by
        domain:

        >>> def domain_as_category(run1, run2):
        ...     # run2['domain'] has the same value, because we always
        ...     # compare two runs of the same problem.
        ...     return run1['domain']

        Example grouping by difficulty:

        >>> def improvement(run1, run2):
        ...     time1 = run1.get('search_time', 1800)
        ...     time2 = run2.get('search_time', 1800)
        ...     if time1 > time2:
        ...         return 'better'
        ...     if time1 == time2:
        ...         return 'equal'
        ...     return 'worse'

        >>> from downward.experiment import FastDownwardExperiment
        >>> exp = FastDownwardExperiment()
        >>> exp.add_report(ScatterPlotReport(
        ...     attributes=['search_time'],
        ...     get_category=improvement))

        Example comparing the number of expanded states for two
        algorithms:

        >>> exp.add_report(ScatterPlotReport(
        ...         attributes=["expansions_until_last_jump"],
        ...         filter_algorithm=["algorithm-1", "algorithm-2"],
        ...         get_category=domain_as_category,
        ...         format="png",  # Use "tex" for pgfplots output.
        ...         ),
        ...     name="scatterplot-expansions")

        """
        # If the size has not been set explicitly, make it a square.
        matplotlib_options = kwargs.get('matplotlib_options', {})
        matplotlib_options.setdefault('figure.figsize', [8, 8])
        kwargs['matplotlib_options'] = matplotlib_options
        PlotReport.__init__(self, **kwargs)
        if not self.attribute:
            logging.critical('ScatterPlotReport needs exactly one attribute')
        # By default all values are in the same category.
        self.get_category = get_category or (lambda run1, run2: None)
        self.show_missing = show_missing
        if self.output_format == 'tex':
            self.writer = ScatterPgfPlots
        else:
            self.writer = ScatterMatplotlib

    def _set_scales(self, xscale, yscale):
        PlotReport._set_scales(self, xscale or self.attribute.scale or 'log', yscale)
        if self.xscale != self.yscale:
            logging.critical('Scatterplots must use the same scale on both axes.')

    def _handle_none_values(self, X, Y, replacement):
        assert len(X) == len(Y), (X, Y)
        if self.show_missing:
            return ([x if x is not None else replacement for x in X],
                    [y if y is not None else replacement for y in Y])
        return zip(*[(x, y) for x, y in zip(X, Y) if x is not None and y is not None])

    def _fill_categories(self, runs):
        # We discard the *runs* parameter.
        # Map category names to value tuples
        categories = defaultdict(list)
        for runs in self.problem_runs.values():
            if len(runs) != 2:
                continue
            run1, run2 = runs
            assert (run1['algorithm'] == self.algorithms[0] and
                    run2['algorithm'] == self.algorithms[1])
            val1 = run1.get(self.attribute)
            val2 = run2.get(self.attribute)
            if val1 is None and val2 is None and not self.show_missing:
                continue
            category = self.get_category(run1, run2)
            categories[category].append((val1, val2))
        return categories

    def _prepare_categories(self, categories):
        categories = PlotReport._prepare_categories(self, categories)

        # Find max-value to fit plot and to draw missing values.
        self.missing_val = 1000

        return categories

    def write(self):
        if not len(self.algorithms) == 2:
            logging.critical(
                'Scatter plots need exactly 2 algorithms: %s' % self.algorithms)
        self.xlabel = self.xlabel or self.algorithms[0]
        self.ylabel = self.ylabel or self.algorithms[1]

        suffix = '.' + self.output_format
        if not self.outfile.endswith(suffix):
            self.outfile += suffix
        tools.makedirs(os.path.dirname(self.outfile))
        self._write_plot(self.runs.values(), self.outfile)
